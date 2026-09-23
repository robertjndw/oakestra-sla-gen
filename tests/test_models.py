import pytest
from pydantic import ValidationError

from oakestra_sla_gen.models import Clarification, DirectConstraint, Microservice, SLARequest
from oakestra_sla_gen.validation import validate_sla


def _microservice(**overrides):
    defaults = dict(
        microservice_name="nginx",
        microservice_namespace="default",
        code="docker.io/library/nginx:latest",
    )
    return Microservice(**{**defaults, **overrides})


def test_name_pattern_rejects_symbols():
    with pytest.raises(ValidationError):
        _microservice(microservice_name="my-service")


def test_name_pattern_rejects_too_long():
    with pytest.raises(ValidationError):
        _microservice(microservice_name="waytoolongname")


def test_port_pattern_rejects_bad_syntax():
    with pytest.raises(ValidationError):
        _microservice(port="not-a-port")


def test_environment_rejects_bad_syntax():
    with pytest.raises(ValidationError):
        _microservice(environment=["NOTKEYVALUE"])


def test_direct_constraint_requires_node_or_cluster():
    with pytest.raises(ValidationError):
        DirectConstraint()


def test_direct_constraint_accepts_node_only():
    constraint = DirectConstraint(node="edge1")
    assert constraint.node == "edge1"
    assert constraint.cluster is None


def test_unknown_field_is_rejected():
    # The docs call this field "vcpu" (singular); the real one is "vcpus". Since the
    # LLM's output is constrained to our schema, a wrong field name should be
    # rejected rather than silently ignored.
    with pytest.raises(ValidationError):
        _microservice(vcpu=1)


def test_to_oakestra_sla_round_trips_through_validate_sla():
    request = SLARequest(
        applications=[
            {
                "application_name": "web",
                "application_namespace": "default",
                "microservices": [
                    {
                        "microservice_name": "nginx",
                        "microservice_namespace": "default",
                        "code": "docker.io/library/nginx:latest",
                        "port": "80:80",
                        "vcpus": 1,
                        "memory": 512,
                    }
                ],
            }
        ]
    )
    sla = request.to_oakestra_sla(customer_id="Admin")

    assert sla["sla_version"] == "v2.0"
    assert sla["customerID"] == "Admin"
    assert sla["applications"][0]["applicationID"] == ""
    assert sla["applications"][0]["microservices"][0]["microserviceID"] == ""
    assert validate_sla(sla) == []


def test_rr_ip_pattern_rejects_non_service_ip():
    with pytest.raises(ValidationError):
        _microservice(addresses={"rr_ip": "192.168.1.4"})


def test_sla_request_needs_an_application_or_a_question():
    with pytest.raises(ValidationError):
        SLARequest(applications=[], questions=[])


def test_sla_request_accepts_questions_only():
    request = SLARequest(
        applications=[], questions=[Clarification(topic="application", question="what?")]
    )
    assert request.applications == []


def test_to_oakestra_sla_requires_an_application():
    request = SLARequest(
        applications=[], questions=[Clarification(topic="application", question="what?")]
    )
    with pytest.raises(ValueError, match="requires at least one application"):
        request.to_oakestra_sla()


def test_rr_ip_survives_into_sla():
    request = SLARequest(
        applications=[
            {
                "application_name": "web",
                "application_namespace": "default",
                "microservices": [_microservice(addresses={"rr_ip": "10.30.0.1"}).model_dump()],
            }
        ]
    )
    sla = request.to_oakestra_sla()
    assert sla["applications"][0]["microservices"][0]["addresses"] == {"rr_ip": "10.30.0.1"}
    assert validate_sla(sla) == []
