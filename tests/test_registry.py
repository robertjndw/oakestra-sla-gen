"""Tests for registry.py: reference parsing, status mapping, and a few live checks.

The status-mapping tests mock the HTTP layer (no network); the `llm` marker tests below
reuse that marker to mean "needs network" (not an LLM here - see pyproject's addopts, which
excludes it by default) and hit real registries.
"""

from __future__ import annotations

import email.message
import json
import urllib.error
import urllib.request

import pytest

from oakestra_sla_gen import registry
from oakestra_sla_gen.registry import (
    DOCKER_HUB_API_HOST,
    _fetch_token,
    _image_exists_cached,
    _manifest_status,
    _parse_ref,
    _parse_www_authenticate,
    image_exists,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    # image_exists is lru_cache'd; without this, an earlier test's monkeypatched result
    # for the same ref would leak into a later test.
    _image_exists_cached.cache_clear()
    yield
    _image_exists_cached.cache_clear()


# --- reference parsing -------------------------------------------------------------


@pytest.mark.parametrize(
    ("ref", "expected"),
    [
        ("nginx", ("registry-1.docker.io", "library/nginx", "latest")),
        ("grafana/grafana:10", ("registry-1.docker.io", "grafana/grafana", "10")),
        ("docker.io/library/redis", ("registry-1.docker.io", "library/redis", "latest")),
        (
            "ghcr.io/home-assistant/home-assistant:stable",
            ("ghcr.io", "home-assistant/home-assistant", "stable"),
        ),
        ("localhost:5000/x", ("localhost:5000", "x", "latest")),
        (
            "nvcr.io/nvidia/tritonserver:24.01-py3",
            ("nvcr.io", "nvidia/tritonserver", "24.01-py3"),
        ),
    ],
)
def test_parse_ref(ref, expected):
    assert _parse_ref(ref) == expected


def test_parse_ref_digest():
    host, repo, tag = _parse_ref(
        "nginx@sha256:e3f191c3d778f06e0b18ff5e6afd7e3a4dbd05ca5f5ee3c60600e8241f5eb8f"
    )
    assert host == "registry-1.docker.io"
    assert repo == "library/nginx"
    assert tag == "sha256:e3f191c3d778f06e0b18ff5e6afd7e3a4dbd05ca5f5ee3c60600e8241f5eb8f"


def test_parse_ref_digest_with_host_and_namespace():
    host, repo, tag = _parse_ref("ghcr.io/foo/bar@sha256:" + "ab" * 32)
    assert host == "ghcr.io"
    assert repo == "foo/bar"
    assert tag == "sha256:" + "ab" * 32


# --- status -> result mapping ------------------------------------------------------


def test_200_means_true(monkeypatch):
    monkeypatch.setattr(registry, "_manifest_status", lambda *a, **k: 200)
    assert image_exists("docker.io/library/nginx") is True


def test_404_means_false(monkeypatch):
    monkeypatch.setattr(registry, "_manifest_status", lambda *a, **k: 404)
    assert image_exists("ghcr.io/some/missing-image") is False


def test_docker_hub_401_means_false(monkeypatch):
    # Docker Hub's real quirk: a nonexistent repo returns 401 even with a valid anon token.
    monkeypatch.setattr(registry, "_manifest_status", lambda *a, **k: 401)
    assert image_exists("docker.io/minio/minio") is False


def test_non_docker_hub_401_means_none(monkeypatch):
    # Elsewhere a 401 after the token retry more plausibly means "private", not "missing".
    monkeypatch.setattr(registry, "_manifest_status", lambda *a, **k: 401)
    assert image_exists("ghcr.io/some/private-image") is None


def test_network_failure_means_none(monkeypatch):
    monkeypatch.setattr(registry, "_manifest_status", lambda *a, **k: None)
    assert image_exists("docker.io/library/nginx") is None


def test_unexpected_status_means_none(monkeypatch):
    monkeypatch.setattr(registry, "_manifest_status", lambda *a, **k: 500)
    assert image_exists("docker.io/library/nginx") is None


# --- www-authenticate parsing and token fetch --------------------------------------


def test_parse_www_authenticate():
    header = (
        'Bearer realm="https://auth.docker.io/token",'
        'service="registry.docker.io",scope="repository:library/nginx:pull"'
    )
    assert _parse_www_authenticate(header) == {
        "realm": "https://auth.docker.io/token",
        "service": "registry.docker.io",
        "scope": "repository:library/nginx:pull",
    }


def test_parse_www_authenticate_ignores_non_bearer():
    assert _parse_www_authenticate('Basic realm="x"') is None


class _FakeResponse:
    def __init__(self, status=200, body=b""):
        self.status = status
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def read(self):
        return self._body


def _http_error(code, www_authenticate=None):
    hdrs = email.message.Message()
    if www_authenticate:
        hdrs["WWW-Authenticate"] = www_authenticate
    url = "https://example.test/v2/x/manifests/latest"
    return urllib.error.HTTPError(url, code, "", hdrs, None)


def test_fetch_token_adds_default_scope(monkeypatch):
    seen_url = {}

    def fake_urlopen(url, timeout=None):
        seen_url["url"] = url
        return _FakeResponse(200, json.dumps({"token": "tok123"}).encode())

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    token = _fetch_token({"realm": "https://auth.example/token"}, "library/nginx", 5.0)

    assert token == "tok123"
    assert "scope=repository%3Alibrary%2Fnginx%3Apull" in seen_url["url"]


def test_fetch_token_network_error_returns_none(monkeypatch):
    def fake_urlopen(url, timeout=None):
        raise OSError("no route")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    assert _fetch_token({"realm": "https://auth.example/token"}, "library/nginx", 5.0) is None


def test_manifest_status_retries_with_token_then_succeeds(monkeypatch):
    calls = []

    def fake_urlopen(req, timeout=None):
        if isinstance(req, str):
            calls.append("token")
            return _FakeResponse(200, json.dumps({"token": "tok123"}).encode())
        calls.append("manifest")
        if req.has_header("Authorization"):
            return _FakeResponse(200)
        raise _http_error(401, 'Bearer realm="https://auth.example/token",service="example"')

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    status = _manifest_status(DOCKER_HUB_API_HOST, "library/nginx", "latest", 5.0)

    assert status == 200
    assert calls == ["manifest", "token", "manifest"]


def test_manifest_status_401_without_challenge_is_returned_as_is(monkeypatch):
    def fake_urlopen(req, timeout=None):
        raise _http_error(401)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    assert _manifest_status("ghcr.io", "some/repo", "latest", 5.0) == 401


def test_manifest_status_network_error_returns_none(monkeypatch):
    def fake_urlopen(req, timeout=None):
        raise OSError("dns failure")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    assert _manifest_status("ghcr.io", "some/repo", "latest", 5.0) is None


# --- live checks (need network) -----------------------------------------------------
# Reuses the `llm` marker (excluded by default in pyproject) to mean "needs network here",
# not an LLM - there's no other marker for "skip unless online" in this project.


def _network_reachable() -> bool:
    try:
        urllib.request.urlopen("https://registry-1.docker.io/v2/", timeout=3)
        return True
    except urllib.error.HTTPError:
        # docker.io's /v2/ root itself answers 401, which still proves reachability.
        return True
    except OSError:
        return False


@pytest.fixture(scope="module", autouse=True)
def _require_network(request):
    if "llm" in [m.name for m in request.node.iter_markers()] and not _network_reachable():
        pytest.skip("network not reachable")


@pytest.mark.llm
def test_live_nginx_exists():
    assert image_exists("docker.io/library/nginx:latest") is True


@pytest.mark.llm
def test_live_minio_missing():
    assert image_exists("docker.io/minio/minio:latest") is False


@pytest.mark.llm
def test_live_uptime_kuma_exists():
    assert image_exists("docker.io/louislam/uptime-kuma:latest") is True


@pytest.mark.llm
def test_live_home_assistant_on_ghcr_exists():
    assert image_exists("ghcr.io/home-assistant/home-assistant:stable") is True


@pytest.mark.llm
def test_live_whoami_missing():
    assert image_exists("docker.io/library/whoami:latest") is False
