"""Playground HTTP API tests with a fake structured-output runnable, no network involved."""

import pytest
from fastapi.testclient import TestClient
from helpers import COMPOSE_YAML, EXISTING_SLA_JSON, FakeStructuredLLM, _ok, _request
from langchain_core.messages import HumanMessage

from oakestra_sla_gen.models import Clarification
from oakestra_sla_gen.server import create_app


def _client(responses):
    fake = FakeStructuredLLM(responses)
    return TestClient(create_app(lambda method: fake)), fake


def test_playground_info_reports_the_model():
    fake = FakeStructuredLLM([])
    client = TestClient(create_app(lambda method: fake, model="qwen/qwen3.8-27b"))

    assert client.get("/playground/info").json() == {"model": "qwen/qwen3.8-27b"}


def test_playground_html_page_is_gone():
    # The UI moved to the separate frontend; the API must not serve a page of its own.
    client, _ = _client([])

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


def test_start_session_from_an_existing_sla_then_modify_it():
    client, fake = _client([_ok(_request("nginx")), _ok(_request("nginx", "redis"))])

    start = client.post(
        "/playground/sessions", json={"sla": EXISTING_SLA_JSON, "check_images": False}
    )

    assert start.status_code == 200
    first_human = [m for m in fake.calls[0] if isinstance(m, HumanMessage)][-1].content
    assert EXISTING_SLA_JSON.strip() in first_human

    response = client.post(
        f"/playground/sessions/{start.json()['session_id']}/answer", json={"text": "add redis"}
    )

    assert response.status_code == 200
    # The follow-up turn still carries the uploaded SLA as conversation history.
    assert any(
        isinstance(m, HumanMessage) and EXISTING_SLA_JSON.strip() in m.content
        for m in fake.calls[1]
    )


def test_start_session_from_an_sla_keeps_its_customer_id_unless_one_is_given():
    uploaded = EXISTING_SLA_JSON.replace('"customerID": "Admin"', '"customerID": "acme"')
    client, _ = _client([_ok(_request("nginx")), _ok(_request("nginx"))])

    kept = client.post("/playground/sessions", json={"sla": uploaded, "check_images": False})
    overridden = client.post(
        "/playground/sessions",
        json={"sla": uploaded, "customer_id": "other", "check_images": False},
    )

    assert kept.json()["sla"]["customerID"] == "acme"
    assert overridden.json()["sla"]["customerID"] == "other"


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


class _PollingLLM(FakeStructuredLLM):
    """Polls the progress route from inside the turn, right before each LLM call."""

    def __init__(self, responses, turn_id):
        super().__init__(responses)
        self.turn_id = turn_id
        self.client: TestClient | None = None
        self.polls: list = []

    def invoke(self, messages):
        response = self.client.get(f"/playground/turns/{self.turn_id}")
        self.polls.append((response.status_code, response.json()))
        return super().invoke(messages)


def _polling_client(responses, turn_id):
    fake = _PollingLLM(responses, turn_id)
    fake.client = TestClient(create_app(lambda method: fake))
    return fake.client, fake


TURN_ID = "0f8e2c1a-5b7d-4c3e-9a10-2b3c4d5e6f70"


def test_turn_progress_shows_finished_attempts_while_the_turn_runs():
    client, fake = _polling_client(
        [_ok(_request("nginx", "nginx")), _ok(_request("nginx"))], TURN_ID
    )

    response = client.post(
        "/playground/sessions", json={"description": "two nginx", "turn_id": TURN_ID}
    )

    assert response.status_code == 200
    first, second = fake.polls
    assert first == (200, {"attempts": []})
    assert second[0] == 200
    assert [a["attempt"] for a in second[1]["attempts"]] == [1]
    assert second[1]["attempts"][0]["errors"]
    # The POST response is unchanged by the turn id.
    assert set(response.json()) == {"session_id", "sla", "questions", "attempts"}


def test_turn_progress_is_gone_once_the_turn_ends():
    client, _ = _client([_ok(_request("nginx")), _ok(_request("nginx", "nginx"))])

    start = client.post(
        "/playground/sessions",
        json={"description": "nginx", "turn_id": TURN_ID, "max_retries": 1},
    )
    assert client.get(f"/playground/turns/{TURN_ID}").status_code == 404

    # A failed turn is cleaned up as well.
    answer = client.post(
        f"/playground/sessions/{start.json()['session_id']}/answer",
        json={"text": "two", "turn_id": TURN_ID},
    )
    assert answer.status_code == 422
    assert client.get(f"/playground/turns/{TURN_ID}").status_code == 404


def test_turn_progress_works_for_answers():
    turn_id = "answer-turn-1"
    client, fake = _polling_client([_ok(_request("nginx")), _ok(_request("redis"))], turn_id)
    session_id = client.post("/playground/sessions", json={"description": "nginx"}).json()[
        "session_id"
    ]

    response = client.post(
        f"/playground/sessions/{session_id}/answer", json={"text": "redis", "turn_id": turn_id}
    )

    assert response.status_code == 200
    # The start had no turn id, so its poll found nothing; the answer's did.
    assert [status for status, _ in fake.polls] == [404, 200]


def test_unknown_turn_returns_404():
    client, _ = _client([])

    assert client.get("/playground/turns/doesnotexist").status_code == 404


def test_turn_progress_is_unregistered_after_an_llm_error():
    class Boom(FakeStructuredLLM):
        def invoke(self, messages):
            raise RuntimeError("model server down")

    fake = Boom([])
    client = TestClient(create_app(lambda method: fake), raise_server_exceptions=False)

    client.post("/playground/sessions", json={"description": "nginx", "turn_id": TURN_ID})

    assert client.get(f"/playground/turns/{TURN_ID}").status_code == 404


@pytest.mark.parametrize("turn_id", ["short", "x" * 65, "has spaces in it", "../../etc/passwd", 7])
def test_invalid_turn_id_is_rejected(turn_id):
    client, fake = _client([_ok(_request("nginx"))])

    response = client.post(
        "/playground/sessions", json={"description": "nginx", "turn_id": turn_id}
    )

    assert response.status_code == 422
    assert fake.calls == []


def test_a_reused_turn_id_keeps_pointing_at_the_first_turn():
    from oakestra_sla_gen import playground

    store = {}

    class Nested(FakeStructuredLLM):
        def invoke(self, messages):
            # The first turn starts a second one with the same id while it is still running.
            if len(self.calls) == 0:
                super().invoke(messages)
                store["inner"] = client.post(
                    "/playground/sessions", json={"description": "nginx", "turn_id": TURN_ID}
                )
                store["poll"] = client.get(f"/playground/turns/{TURN_ID}")
                return self.responses[0]
            return super().invoke(messages)

    fake = Nested([_ok(_request("nginx")), _ok(_request("nginx"))])
    client = TestClient(create_app(lambda method: fake))
    assert playground.MAX_TURNS > 1

    outer = client.post("/playground/sessions", json={"description": "nginx", "turn_id": TURN_ID})

    assert outer.status_code == 200
    assert store["inner"].status_code == 200
    # The inner turn finished first; it must not have removed the outer turn's entry.
    assert store["poll"].status_code == 200
    assert client.get(f"/playground/turns/{TURN_ID}").status_code == 404


def test_the_oldest_running_turn_is_evicted_past_the_cap(monkeypatch):
    from oakestra_sla_gen import playground

    monkeypatch.setattr(playground, "MAX_TURNS", 1)
    store = {}

    class Nested(FakeStructuredLLM):
        def invoke(self, messages):
            if len(self.calls) == 0:
                super().invoke(messages)
                store["inner"] = client.post(
                    "/playground/sessions", json={"description": "nginx", "turn_id": "inner-turn"}
                )
                return self.responses[0]
            store["outer_poll"] = client.get("/playground/turns/outer-turn")
            store["inner_poll"] = client.get("/playground/turns/inner-turn")
            return super().invoke(messages)

    fake = Nested([_ok(_request("nginx")), _ok(_request("nginx"))])
    client = TestClient(create_app(lambda method: fake))

    outer = client.post(
        "/playground/sessions", json={"description": "nginx", "turn_id": "outer-turn"}
    )

    # Eviction costs the outer turn its progress, not its result.
    assert outer.status_code == 200
    assert store["inner"].status_code == 200
    assert store["outer_poll"].status_code == 404
    assert store["inner_poll"].status_code == 200
