"""Validation tests, using Oakestra's own fixtures plus hand-made bad SLAs.

Fixture caveats (checked against the real oakestra-sla-gen behavior at commit
0803bb1d7730612f5fbe819ab388f3594c21a2c4, see oakestra/tests/sla_test.py):

- Oakestra's own parser (`versioned_sla_parser.parse_sla_json`) reads
  `sla["sla_version"]` directly before it ever runs the JSON Schema, so a
  missing key raises KeyError there. `sla_flawed_1` and `sla_flawed_3` are the
  two fixtures that trigger that path (both lack `sla_version`). We call
  `jsonschema` directly instead of going through that parser, so for us a
  missing `sla_version` is just another schema error in the returned list,
  not an exception. Both fixtures are still asserted to produce validate_sla
  errors below, just not a KeyError.
- `sla_correct_1` uses `application_name: "ExampleApplication33"`, which is
  21 characters. Oakestra's own JSON Schema allows up to 32, so it is a valid
  upstream SLA. Our `validate_sla` additionally enforces the docs' stricter
  1-10 character rule (a deliberate choice, not a bug - see README), so this
  fixture is expected to fail our full check while still passing the
  upstream JSON Schema on its own.
"""

import json
from pathlib import Path

import pytest

from oakestra_sla_gen.validation import _schema_errors, validate_sla

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


@pytest.mark.parametrize(
    "name", ["sla_correct_1", "sla_correct_2", "sla_correct_3", "sla_correct_4"]
)
def test_correct_fixtures_pass_upstream_schema(name):
    assert _schema_errors(_load(f"{name}.json")) == []


@pytest.mark.parametrize("name", ["sla_correct_2", "sla_correct_3", "sla_correct_4"])
def test_correct_fixtures_pass_full_validation(name):
    assert validate_sla(_load(f"{name}.json")) == []


def test_correct_1_fails_our_stricter_name_length_rule():
    # Valid upstream (see test above), but application_name is longer than the
    # 1-10 character rule we enforce on top of Oakestra's own schema.
    errors = validate_sla(_load("sla_correct_1.json"))
    assert any("application_name" in e for e in errors)


@pytest.mark.parametrize(
    "name", ["sla_flawed_1", "sla_flawed_2", "sla_flawed_3", "sla_flawed_4", "sla_flawed_5"]
)
def test_flawed_fixtures_fail(name):
    assert validate_sla(_load(f"{name}.json")) != []


def _minimal_sla(**microservice_overrides):
    microservice = {
        "microservice_name": "nginx",
        "microservice_namespace": "default",
        "virtualization": "container",
        "code": "docker.io/library/nginx:latest",
        **microservice_overrides,
    }
    return {
        "sla_version": "v2.0",
        "customerID": "Admin",
        "applications": [
            {
                "application_name": "web",
                "application_namespace": "default",
                "microservices": [microservice],
            }
        ],
    }


def test_bad_port_syntax_produces_error():
    errors = validate_sla(_minimal_sla(port="8o80"))
    assert any("port" in e for e in errors)


def test_name_with_symbols_produces_error():
    sla = _minimal_sla()
    sla["applications"][0]["application_name"] = "my-app!"
    errors = validate_sla(sla)
    assert any("application_name" in e for e in errors)


def test_missing_code_produces_error():
    sla = _minimal_sla()
    del sla["applications"][0]["microservices"][0]["code"]
    errors = validate_sla(sla)
    assert any("code" in e for e in errors)


def test_negative_resource_produces_error():
    errors = validate_sla(_minimal_sla(vcpus=-1))
    assert any("vcpus" in e for e in errors)


def test_direct_constraint_without_target_produces_error():
    errors = validate_sla(_minimal_sla(constraints=[{"type": "direct"}]))
    assert any("constraints" in e for e in errors)


def test_duplicate_microservice_names_produce_error():
    sla = _minimal_sla()
    sla["applications"][0]["microservices"].append(dict(sla["applications"][0]["microservices"][0]))
    errors = validate_sla(sla)
    assert any("used more than once" in e for e in errors)


@pytest.mark.parametrize(
    "sla",
    [
        [1, 2],
        {"sla_version": "v2.0", "customerID": "Admin", "applications": ["nope"]},
        {"sla_version": "v2.0", "customerID": "Admin", "applications": [{"microservices": [1]}]},
    ],
)
def test_malformed_shapes_return_errors_instead_of_crashing(sla):
    assert validate_sla(sla)


@pytest.mark.parametrize("rr_ip", ["192.168.1.4", "10.30.0.256", "10.30.1"])
def test_rr_ip_outside_service_range_produces_error(rr_ip):
    errors = validate_sla(_minimal_sla(addresses={"rr_ip": rr_ip}))
    assert any("rr_ip" in e for e in errors)


def test_rr_ip_in_service_range_is_valid():
    assert validate_sla(_minimal_sla(addresses={"rr_ip": "10.30.0.1"})) == []


def test_duplicate_rr_ip_produces_error():
    sla = _minimal_sla(addresses={"rr_ip": "10.30.0.1"})
    other = dict(sla["applications"][0]["microservices"][0], microservice_name="other")
    sla["applications"][0]["microservices"].append(other)
    errors = validate_sla(sla)
    assert any("already used" in e for e in errors)


def test_malformed_addresses_do_not_crash():
    assert validate_sla(_minimal_sla(addresses="10.30.0.1"))
    assert validate_sla(_minimal_sla(addresses={"rr_ip": ["10.30.0.1"]}))
