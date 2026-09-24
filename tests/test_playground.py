"""Playground HTTP API tests with a fake structured-output runnable, no network involved."""

import posixpath
import re

from fastapi.testclient import TestClient
from helpers import COMPOSE_YAML, FakeStructuredLLM, _ok, _request
from langchain_core.messages import HumanMessage

from oakestra_sla_gen.models import Clarification
from oakestra_sla_gen.server import create_app


def _client(responses, playground=True):
    fake = FakeStructuredLLM(responses)
    return TestClient(create_app(lambda method: fake, playground=playground)), fake


def test_playground_page_served_when_enabled():
    client, _ = _client([])

    response = client.get("/playground")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_playground_assets_and_module_imports_resolve():
    # There's no bundler, so a typo in a <link>, <script> or import path only shows up as a
    # blank page in the browser. Follow every reference from the page to catch that here.
    client, _ = _client([])
    page = client.get("/playground").text
    pending = re.findall(r'(?:href|src)="(/playground/static/[^"]+)"', page)
    assert any(url.endswith(".css") for url in pending)
    assert any(url.endswith(".js") for url in pending)

    seen = set()
    while pending:
        url = pending.pop()
        if url in seen:
            continue
        seen.add(url)
        response = client.get(url)
        assert response.status_code == 200, url
        if url.endswith(".js"):
            assert "javascript" in response.headers["content-type"], url
            for spec in re.findall(r'^import .*?from "(\.[^"]+)";', response.text, re.M | re.S):
                pending.append(posixpath.normpath(posixpath.join(posixpath.dirname(url), spec)))

    assert len([url for url in seen if url.endswith(".js")]) > 1


def test_playground_info_reports_the_model():
    fake = FakeStructuredLLM([])
    client = TestClient(create_app(lambda method: fake, playground=True, model="qwen/qwen3.8-27b"))

    assert client.get("/playground/info").json() == {"model": "qwen/qwen3.8-27b"}


def test_playground_page_404_when_not_enabled():
    client, _ = _client([], playground=False)

    assert client.get("/playground").status_code == 404


def test_start_session_returns_sla_questions_and_attempts():
    invalid = _request("nginx", "nginx")
    valid = _request("nginx")
    client, fake = _client([_ok(invalid), _ok(valid)])

    response = client.post("/playground/sessions", json={"description": "two nginx"})

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"]
    assert body["sla"]["applications"][0]["microservices"][0]["microservice_name"] == "nginx"
    assert body["questions"] == []
    assert [a["attempt"] for a in body["attempts"]] == [1, 2]
    assert body["attempts"][0]["errors"]
    assert body["attempts"][1]["errors"] == []
    assert len(fake.calls) == 2


def test_start_session_with_compose_works():
    client, fake = _client([_ok(_request("web"))])

    response = client.post("/playground/sessions", json={"compose": COMPOSE_YAML})

    assert response.status_code == 200
    body = response.json()
    assert body["sla"]["applications"][0]["microservices"][0]["microservice_name"] == "web"
    last_human = [m for m in fake.calls[0] if isinstance(m, HumanMessage)][-1].content
    assert COMPOSE_YAML in last_human


def test_answer_continues_the_same_session():
    first = _request("nginx")
    first.questions = [
        Clarification(topic="nginx memory", question="how much memory?", assumption="128MB")
    ]
    second = _request("redis")
    client, fake = _client([_ok(first), _ok(second)])

    start = client.post("/playground/sessions", json={"description": "an nginx server"}).json()
    session_id = start["session_id"]
    assert start["questions"][0]["topic"] == "nginx memory"

    response = client.post(
        f"/playground/sessions/{session_id}/answer", json={"text": "use redis instead"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session_id
    assert body["sla"]["applications"][0]["microservices"][0]["microservice_name"] == "redis"

    last_human = [m for m in fake.calls[1] if isinstance(m, HumanMessage)][-1].content
    assert "Open questions I was shown" in last_human
    assert "My answer: use redis instead" in last_human


def test_start_session_exhausting_retries_returns_422_and_session_still_answers():
    invalid = _request("nginx", "nginx")
    valid = _request("nginx")
    client, fake = _client([_ok(invalid), _ok(invalid), _ok(valid)])

    response = client.post(
        "/playground/sessions", json={"description": "two nginx", "max_retries": 2}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["errors"]
    assert body["last_candidate"] is not None
    assert [a["attempt"] for a in body["attempts"]] == [1, 2]
    session_id = body["session_id"]
    assert session_id

    answer = client.post(
        f"/playground/sessions/{session_id}/answer", json={"text": "just one nginx"}
    )
    assert answer.status_code == 200
    assert (
        answer.json()["sla"]["applications"][0]["microservices"][0]["microservice_name"] == "nginx"
    )
    assert len(fake.calls) == 3


def test_answer_unknown_session_returns_404():
    client, _ = _client([])

    response = client.post("/playground/sessions/doesnotexist/answer", json={"text": "hi"})

    assert response.status_code == 404


def test_delete_session_removes_it():
    client, _ = _client([_ok(_request("nginx"))])
    start = client.post("/playground/sessions", json={"description": "nginx"}).json()
    session_id = start["session_id"]

    delete = client.delete(f"/playground/sessions/{session_id}")
    assert delete.status_code == 204

    answer = client.post(f"/playground/sessions/{session_id}/answer", json={"text": "hi"})
    assert answer.status_code == 404


def test_a_third_session_evicts_the_oldest(monkeypatch):
    from oakestra_sla_gen import playground

    monkeypatch.setattr(playground, "MAX_SESSIONS", 2)
    responses = [_ok(_request("nginx"))] * 3
    client, _ = _client(responses)

    ids = []
    for _ in range(3):
        body = client.post("/playground/sessions", json={"description": "nginx"}).json()
        ids.append(body["session_id"])

    evicted = client.post(f"/playground/sessions/{ids[0]}/answer", json={"text": "hi"})
    assert evicted.status_code == 404
    assert client.delete(f"/playground/sessions/{ids[1]}").status_code == 204
    assert client.delete(f"/playground/sessions/{ids[2]}").status_code == 204
