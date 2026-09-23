"""HTTP API tests with a fake structured-output runnable, no network involved."""

import httpx
import openai
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from test_generator import FakeStructuredLLM, _request

from oakestra_sla_gen.server import create_app


def _client(responses, seen_methods=None):
    fake = FakeStructuredLLM(responses)

    def factory(method):
        if seen_methods is not None:
            seen_methods.append(method)
        return fake

    return TestClient(create_app(factory)), fake


def _ok(request):
    return {"raw": AIMessage(content="x"), "parsed": request, "parsing_error": None}


def test_generate_returns_verified_sla_and_passes_method_through():
    methods = []
    client, _ = _client([_ok(_request("nginx"))], seen_methods=methods)

    response = client.post("/generate", json={"description": "nginx", "method": "json_schema"})

    assert response.status_code == 200
    assert response.json()["applications"][0]["microservices"][0]["microservice_name"] == "nginx"
    assert methods == ["json_schema"]


def test_generate_reports_errors_when_retries_run_out():
    client, fake = _client([_ok(_request("nginx", "nginx"))] * 2)

    response = client.post("/generate", json={"description": "two nginx", "max_retries": 2})

    assert response.status_code == 422
    body = response.json()
    assert body["errors"]
    assert body["last_candidate"] is not None
    assert len(fake.calls) == 2


def test_generate_maps_llm_connection_errors_to_502():
    class Unreachable(FakeStructuredLLM):
        def invoke(self, messages):
            raise openai.APIConnectionError(request=httpx.Request("POST", "http://llm"))

    client = TestClient(create_app(lambda method: Unreachable([])))

    response = client.post("/generate", json={"description": "nginx"})

    assert response.status_code == 502


def test_generate_rejects_bad_requests_before_calling_the_llm():
    client, fake = _client([])

    assert client.post("/generate", json={"description": ""}).status_code == 422
    assert client.post("/generate", json={"description": "x", "method": "nope"}).status_code == 422
    assert client.post("/generate", json={"description": "x", "max_retries": 0}).status_code == 422
    assert fake.calls == []


def test_validate_accepts_valid_and_reports_invalid_sla():
    client, _ = _client([_ok(_request("nginx"))])
    sla = client.post("/generate", json={"description": "nginx"}).json()

    assert client.post("/validate", json=sla).json() == {"valid": True, "errors": []}

    sla["applications"][0]["microservices"][0]["port"] = "not-a-port"
    body = client.post("/validate", json=sla).json()
    assert body["valid"] is False
    assert body["errors"]
