"""Integration tests against a real LLM server. Run with `uv run pytest -m llm`.

Skipped automatically if LM Studio isn't reachable, so the default `uv run
pytest` (which excludes this file's tests via the `llm` marker selection
below) never needs a live model.
"""

import urllib.request

import pytest

from oakestra_sla_gen.cli import DEFAULT_MODEL, DEFAULT_REASONING_EFFORT
from oakestra_sla_gen.generator import NeedsClarification, SLASession, build_llm, generate_sla
from oakestra_sla_gen.validation import validate_sla

BASE_URL = "http://127.0.0.1:1234/v1"

pytestmark = pytest.mark.llm


def _server_reachable() -> bool:
    try:
        urllib.request.urlopen(f"{BASE_URL}/models", timeout=2)
        return True
    except OSError:
        return False


@pytest.fixture(scope="module", autouse=True)
def _require_server():
    if not _server_reachable():
        pytest.skip(f"LM Studio not reachable at {BASE_URL}")


def _microservices(sla):
    return [m for app in sla["applications"] for m in app["microservices"]]


def test_single_service():
    sla = _generate("single nginx web server exposing port 80, 1 cpu, 512MB")
    [nginx] = _microservices(sla)
    assert "nginx" in nginx["code"]
    assert nginx["port"] == "80:80"
    assert nginx["vcpus"] == 1
    assert nginx["memory"] == 512


def test_multiple_services_keep_env_and_constraint():
    # Guards against the failure mode that made `prompt` the default method:
    # constrained decoding silently dropped the second service and env vars
    # while still producing a verifiable SLA.
    sla = _generate(
        "a postgres database with 2 cpus and 2GB ram, password secret, "
        "plus a grafana dashboard on port 3000 that runs on node jetson1"
    )
    services = {m["microservice_name"]: m for m in _microservices(sla)}
    assert set(services) == {"postgres", "grafana"}
    assert services["postgres"]["memory"] == 2048
    assert any("secret" in e for e in services["postgres"]["environment"])
    assert services["grafana"]["constraints"] == [{"type": "direct", "node": "jetson1"}]


def test_unikernel():
    [service] = _microservices(_generate("a unikernel hello world"))
    assert service["virtualization"] == "unikernel"


def test_vague_description_returns_only_questions():
    # The main bug this feature fixes: a description too vague to draft anything used to
    # get forced into inventing an app instead of asking what to deploy.
    with pytest.raises(NeedsClarification) as exc_info:
        generate_sla("deploy my app", llm=_llm(), max_retries=3)
    assert exc_info.value.questions


def test_implausible_memory_yields_a_question():
    draft = _session().start("a redis cache with 10TB of memory")
    assert draft.sla is not None
    assert any(
        "memory" in q.topic.lower() or "memory" in q.question.lower() for q in draft.questions
    )


def test_two_turn_session_refines_the_draft():
    session = _session()
    session.start("a postgres database")
    draft = session.answer("use version 16 with password pw1")

    assert draft.sla is not None
    [postgres] = _microservices(draft.sla)
    assert "postgres:16" in postgres["code"]
    assert any("pw1" in e for e in postgres["environment"])


def _llm():
    return build_llm(
        base_url=BASE_URL, model=DEFAULT_MODEL, reasoning_effort=DEFAULT_REASONING_EFFORT
    )


def _session():
    return SLASession(llm=_llm(), max_retries=3)


def _generate(description):
    sla = generate_sla(description, llm=_llm(), max_retries=3)
    assert validate_sla(sla) == []
    return sla
