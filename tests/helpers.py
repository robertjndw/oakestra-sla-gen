"""Fakes and fixtures shared by several test modules."""

from langchain_core.messages import AIMessage

from oakestra_sla_gen.models import SLARequest

COMPOSE_YAML = """\
services:
  web:
    image: nginx:1.25
    ports:
      - "8080:80"
"""

EXISTING_SLA_JSON = """\
{
  "sla_version": "v2.0",
  "customerID": "Admin",
  "applications": [
    {
      "applicationID": "",
      "application_name": "web",
      "application_namespace": "default",
      "microservices": [
        {
          "microserviceID": "",
          "microservice_name": "nginx",
          "microservice_namespace": "default",
          "virtualization": "container",
          "code": "docker.io/library/nginx:1.25",
          "port": "8080:80",
          "vcpus": 1,
          "memory": 128
        }
      ]
    }
  ]
}
"""


def _microservice(name="nginx"):
    return {
        "microservice_name": name,
        "microservice_namespace": "default",
        "code": "docker.io/library/nginx:latest",
    }


def _request(*names):
    return SLARequest(
        applications=[
            {
                "application_name": "web",
                "application_namespace": "default",
                "microservices": [_microservice(n) for n in names],
            }
        ]
    )


class FakeStructuredLLM:
    """Returns each of `responses` in order and records the messages it was called with."""

    def __init__(self, responses):
        self.responses = responses
        self.calls: list[list] = []

    def invoke(self, messages):
        self.calls.append(list(messages))
        return self.responses[len(self.calls) - 1]


def _ok(request, content="x"):
    """A structured-LLM result for a response that parsed into `request`."""
    return {"raw": AIMessage(content=content), "parsed": request, "parsing_error": None}
