"""Checks whether an `image:tag` a generated SLA references actually exists in its registry.

Talks to the OCI distribution API directly (`HEAD /v2/<repo>/manifests/<tag>`) rather than
pulling in a registry client library, since all we need is existence, not the manifest itself.
"""

from __future__ import annotations

import functools
import json
import re
import urllib.error
import urllib.parse
import urllib.request

DOCKER_HUB_HOST = "docker.io"
DOCKER_HUB_API_HOST = "registry-1.docker.io"

_ACCEPT = ", ".join(
    [
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    ]
)

_WWW_AUTH_RE = re.compile(r'(\w+)="([^"]*)"')


def _parse_ref(ref: str) -> tuple[str, str, str]:
    """Split a Docker-style image reference into (api_host, repository, tag_or_digest).

    Mirrors Docker's own resolution rules: the first path component is only treated as a
    registry host if it looks like one (has a dot/colon, or is literally "localhost") -
    otherwise the whole thing is assumed to live on Docker Hub.
    """
    name = ref
    tag = "latest"

    # Digest refs and tag refs use different separators and can't both be present.
    if "@" in name:
        name, digest = name.split("@", 1)
        tag = digest
    elif ":" in name.rsplit("/", 1)[-1]:
        name, tag = name.rsplit(":", 1)

    parts = name.split("/", 1)
    if len(parts) == 2 and ("." in parts[0] or ":" in parts[0] or parts[0] == "localhost"):
        host, repo = parts
    else:
        host, repo = DOCKER_HUB_HOST, name

    if host == DOCKER_HUB_HOST:
        host = DOCKER_HUB_API_HOST
        if "/" not in repo:
            repo = f"library/{repo}"

    return host, repo, tag


def _parse_www_authenticate(header: str) -> dict[str, str] | None:
    if not header.lower().startswith("bearer "):
        return None
    return dict(_WWW_AUTH_RE.findall(header))


def _fetch_token(challenge: dict[str, str], repo: str, timeout: float) -> str | None:
    realm = challenge.get("realm")
    if not realm:
        return None
    params = {k: v for k, v in challenge.items() if k != "realm"}
    if "scope" not in params:
        params["scope"] = f"repository:{repo}:pull"
    query = "&".join(f"{k}={urllib.parse.quote(v, safe='')}" for k, v in params.items())
    url = f"{realm}?{query}" if query else realm
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            data = json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    return data.get("token") or data.get("access_token")


def _manifest_status(host: str, repo: str, tag: str, timeout: float) -> int | None:
    """Return the HTTP status of a manifest lookup, retrying once with a token on 401.

    Returns None on any transport failure (caller maps that to "unknown").
    """
    url = f"https://{host}/v2/{repo}/manifests/{tag}"
    # HEAD, not GET: Docker Hub counts manifest GETs against the anonymous pull rate
    # limit, which would eat into the quota the user's actual deployments need.
    request = urllib.request.Request(url, headers={"Accept": _ACCEPT}, method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        if exc.code != 401:
            return exc.code
        challenge = _parse_www_authenticate(exc.headers.get("WWW-Authenticate", ""))
        if challenge is None:
            return exc.code
        token = _fetch_token(challenge, repo, timeout)
        if token is None:
            return exc.code
        request.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as resp:
                return resp.status
        except urllib.error.HTTPError as exc2:
            return exc2.code
        except (urllib.error.URLError, TimeoutError, OSError):
            return None
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


@functools.lru_cache(maxsize=256)
def _image_exists_cached(ref: str, timeout: float) -> bool | None:
    host, repo, tag = _parse_ref(ref)
    status = _manifest_status(host, repo, tag, timeout)

    if status == 200:
        return True
    if status == 404:
        return False
    if status == 401:
        # Docker Hub returns 401 (not 404) for a repo that doesn't exist, even with a
        # valid anonymous token - verified against minio/minio and eclipse-mosquitto/mosquitto,
        # both nonexistent repos, versus library/nginx which returns 200. Elsewhere a 401/403
        # after the token retry more plausibly means "private", so we can't call it missing.
        # A private Docker Hub repo also lands here as False; the generator copes by turning
        # user-typed images into a question instead of making the model replace them.
        return False if host == DOCKER_HUB_API_HOST else None
    return None


def image_exists(ref: str, timeout: float = 5.0) -> bool | None:
    """True if the image:tag resolves in its registry, False if the registry says it doesn't
    exist, None if we can't tell (network error, timeout, private/auth-required registry,
    unexpected status)."""
    return _image_exists_cached(ref, timeout)
