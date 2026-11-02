"""Playground tests for `Prefer: respond-async`, with fake LLMs and no network involved."""

import threading
import time

import httpx
import openai
import pytest
from fastapi.testclient import TestClient
from helpers import FakeStructuredLLM, _ok, _request

from oakestra_sla_gen import playground
from oakestra_sla_gen.server import create_app

ASYNC = {"Prefer": "respond-async"}
TURN_ID = "async-turn-0001"


def _inline_client(responses_or_llm):
    fake = (
        responses_or_llm
        if isinstance(responses_or_llm, FakeStructuredLLM)
        else FakeStructuredLLM(responses_or_llm)
    )
    app = create_app(lambda method: fake, run_in_background=lambda fn: fn())
    return TestClient(app, raise_server_exceptions=False), fake


def _start(client, **extra):
    return client.post(
        "/playground/sessions", json={"description": "nginx", **extra}, headers=ASYNC
    )


class _Raising(FakeStructuredLLM):
    def __init__(self, error):
        super().__init__([])
        self.error = error

    def invoke(self, messages):
        raise self.error


def test_async_start_returns_202_with_the_given_turn_id():
    client, _ = _inline_client([_ok(_request("nginx"))])

    response = _start(client, turn_id=TURN_ID)

    assert response.status_code == 202
    assert response.headers["Preference-Applied"] == "respond-async"
    body = response.json()
    assert set(body) == {"session_id", "turn_id"}
    assert body["turn_id"] == TURN_ID


def test_async_start_generates_a_turn_id_when_omitted():
    client, _ = _inline_client([_ok(_request("nginx"))])

    body = _start(client).json()

    assert len(body["turn_id"]) == 32
    poll = client.get(f"/playground/turns/{body['turn_id']}")
    assert poll.status_code == 200


@pytest.mark.parametrize(
    "prefer", ["RESPOND-ASYNC", "return=minimal, Respond-Async", "respond-async;x=1"]
)
def test_prefer_token_is_matched_case_insensitively_in_a_list(prefer):
    client, _ = _inline_client([_ok(_request("nginx"))])

    response = client.post(
        "/playground/sessions", json={"description": "nginx"}, headers={"Prefer": prefer}
    )

    assert response.status_code == 202


def test_other_prefer_values_stay_blocking():
    client, _ = _inline_client([_ok(_request("nginx"))])

    response = client.post(
        "/playground/sessions",
        json={"description": "nginx"},
        headers={"Prefer": "return=minimal"},
    )

    assert response.status_code == 200
    assert "Preference-Applied" not in response.headers


def test_finished_async_turn_reports_the_200_result():
    client, _ = _inline_client([_ok(_request("nginx"))])
    started = _start(client, turn_id=TURN_ID).json()

    poll = client.get(f"/playground/turns/{TURN_ID}").json()

    assert poll["done"] is True
    assert poll["status"] == 200
    assert poll["result"]["session_id"] == started["session_id"]
    assert poll["result"]["sla"]["applications"][0]["microservices"][0]["microservice_name"] == (
        "nginx"
    )
    assert poll["attempts"] == poll["result"]["attempts"]
    # Retained: a second fetch still works.
    assert client.get(f"/playground/turns/{TURN_ID}").status_code == 200


def test_async_failure_result_matches_the_blocking_422_body():
    invalid = _request("nginx", "nginx")
    blocking_client, _ = _inline_client([_ok(invalid), _ok(invalid)])
    blocking = blocking_client.post(
        "/playground/sessions", json={"description": "two", "max_retries": 2}
    ).json()
    client, _ = _inline_client([_ok(invalid), _ok(invalid)])
    started = _start(client, description="two", max_retries=2, turn_id=TURN_ID).json()

    poll = client.get(f"/playground/turns/{TURN_ID}").json()

    assert poll["done"] is True
    assert poll["status"] == 422
    result = poll["result"]
    assert result["kind"] == "generation_failed"
    assert result["session_id"] == started["session_id"]
    expected = dict(blocking, session_id=started["session_id"])
    assert result == expected


def test_async_answer_after_a_failed_turn_works():
    invalid = _request("nginx", "nginx")
    client, _ = _inline_client([_ok(invalid), _ok(_request("nginx"))])
    started = _start(client, max_retries=1, turn_id=TURN_ID).json()
    assert client.get(f"/playground/turns/{TURN_ID}").json()["status"] == 422

    answer = client.post(
        f"/playground/sessions/{started['session_id']}/answer",
        json={"text": "one", "turn_id": "async-turn-0002"},
        headers=ASYNC,
    )

    assert answer.status_code == 202
    assert client.get("/playground/turns/async-turn-0002").json()["status"] == 200


def test_openai_error_becomes_a_502_result():
    error = openai.APIConnectionError(request=httpx.Request("POST", "http://llm"))
    client, _ = _inline_client(_Raising(error))
    _start(client, turn_id=TURN_ID)

    poll = client.get(f"/playground/turns/{TURN_ID}").json()

    assert poll["done"] is True
    assert poll["status"] == 502
    assert poll["result"]["detail"].startswith("LLM server error: ")


def test_unexpected_error_becomes_a_500_result_and_is_logged(caplog):
    client, _ = _inline_client(_Raising(RuntimeError("boom")))

    with caplog.at_level("ERROR"):
        _start(client, turn_id=TURN_ID)

    poll = client.get(f"/playground/turns/{TURN_ID}").json()
    assert poll["status"] == 500
    assert poll["result"] == {"detail": "internal error"}
    assert any(r.exc_info for r in caplog.records)


class _GatedLLM(FakeStructuredLLM):
    def __init__(self, responses):
        super().__init__(responses)
        self.entered = threading.Event()
        self.release = threading.Event()

    def invoke(self, messages):
        self.entered.set()
        assert self.release.wait(timeout=10)
        return super().invoke(messages)


def _threaded_client(fake):
    return TestClient(create_app(lambda method: fake), raise_server_exceptions=False)


def _wait_done(client, turn_id):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        poll = client.get(f"/playground/turns/{turn_id}").json()
        if poll["done"]:
            return poll
        time.sleep(0.01)
    raise AssertionError("turn did not finish")


def test_running_async_turn_reports_attempts_and_done_false():
    fake = _GatedLLM([_ok(_request("nginx", "nginx")), _ok(_request("nginx"))])
    client = _threaded_client(fake)

    started = _start(client, turn_id=TURN_ID)
    assert started.status_code == 202
    assert fake.entered.wait(timeout=10)

    poll = client.get(f"/playground/turns/{TURN_ID}")
    assert poll.json() == {"attempts": [], "done": False}

    fake.release.set()
    done = _wait_done(client, TURN_ID)
    assert done["status"] == 200
    assert [a["attempt"] for a in done["attempts"]] == [1, 2]


def test_second_answer_while_a_turn_runs_gets_409():
    fake = _GatedLLM([_ok(_request("nginx")), _ok(_request("redis"))])
    client = _threaded_client(fake)
    # The first turn runs through an open gate; the gate then closes for the answer.
    fake.release.set()
    session_id = client.post("/playground/sessions", json={"description": "nginx"}).json()[
        "session_id"
    ]
    fake.release.clear()
    fake.entered.clear()

    first = client.post(
        f"/playground/sessions/{session_id}/answer",
        json={"text": "redis", "turn_id": TURN_ID},
        headers=ASYNC,
    )
    assert first.status_code == 202
    assert fake.entered.wait(timeout=10)

    for headers in (ASYNC, {}):
        second = client.post(
            f"/playground/sessions/{session_id}/answer", json={"text": "again"}, headers=headers
        )
        assert second.status_code == 409

    fake.release.set()
    assert _wait_done(client, TURN_ID)["status"] == 200
    # The worker released the lock, so the session takes another turn.
    fake.responses.append(_ok(_request("nginx")))
    again = client.post(f"/playground/sessions/{session_id}/answer", json={"text": "back"})
    assert again.status_code == 200


def test_unknown_session_is_a_synchronous_404_even_with_prefer():
    client, _ = _inline_client([])

    response = client.post("/playground/sessions/nope/answer", json={"text": "hi"}, headers=ASYNC)

    assert response.status_code == 404
    assert "Preference-Applied" not in response.headers


@pytest.mark.parametrize(
    "path, body",
    [
        ("/playground/sessions", {"description": "nginx", "turn_id": "short"}),
        ("/playground/sessions", {}),
    ],
)
def test_bad_body_is_a_synchronous_422_even_with_prefer(path, body):
    client, fake = _inline_client([_ok(_request("nginx"))])

    response = client.post(path, json=body, headers=ASYNC)

    assert response.status_code == 422
    assert fake.calls == []


def test_bad_answer_body_is_a_synchronous_422_even_with_prefer():
    client, _ = _inline_client([_ok(_request("nginx"))])
    session_id = _start(client).json()["session_id"]

    response = client.post(
        f"/playground/sessions/{session_id}/answer", json={"text": ""}, headers=ASYNC
    )

    assert response.status_code == 422


def test_finished_async_turn_expires_after_the_ttl(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(playground.time, "monotonic", lambda: clock[0])
    client, _ = _inline_client([_ok(_request("nginx"))])
    _start(client, turn_id=TURN_ID)

    clock[0] += playground.TURN_RESULT_TTL_SECONDS - 1
    assert client.get(f"/playground/turns/{TURN_ID}").status_code == 200

    clock[0] += 2
    assert client.get(f"/playground/turns/{TURN_ID}").status_code == 404


def test_blocking_turn_is_not_retained_after_finishing():
    client, _ = _inline_client([_ok(_request("nginx"))])

    client.post("/playground/sessions", json={"description": "nginx", "turn_id": TURN_ID})

    assert client.get(f"/playground/turns/{TURN_ID}").status_code == 404


def test_eviction_past_the_cap_prefers_finished_turns(monkeypatch):
    monkeypatch.setattr(playground, "MAX_TURNS", 2)
    fake = _GatedLLM([_ok(_request("nginx")), _ok(_request("nginx")), _ok(_request("nginx"))])
    client = _threaded_client(fake)

    # The first turn runs to completion and stays in the store as a finished result.
    assert _start(client, turn_id="finished-turn").status_code == 202
    assert fake.entered.wait(timeout=10)
    fake.release.set()
    assert _wait_done(client, "finished-turn")["status"] == 200
    fake.release.clear()
    fake.entered.clear()

    # The second one stays blocked, so it is running when the store fills up.
    assert _start(client, turn_id="running-turn").status_code == 202
    assert fake.entered.wait(timeout=10)
    # Store is full (finished + running). A third turn must evict the finished one.
    assert _start(client, turn_id="third-turn").status_code == 202

    assert client.get("/playground/turns/finished-turn").status_code == 404
    assert client.get("/playground/turns/running-turn").status_code == 200
    assert client.get("/playground/turns/third-turn").status_code == 200
    fake.release.set()
