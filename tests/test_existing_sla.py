"""Tests for parsing and templating an uploaded, existing SLA."""

import json
import pathlib

import pytest
from helpers import EXISTING_SLA_JSON

from oakestra_sla_gen.existing_sla import (
    MAX_SLA_CHARS,
    ExistingSLAError,
    existing_sla_message,
    load_existing_sla,
    resolve_customer_id,
    unsupported_fields,
)

_FIXTURES = pathlib.Path(__file__).parent / "fixtures"


def test_load_existing_sla_accepts_a_valid_sla():
    data = load_existing_sla(EXISTING_SLA_JSON)
    assert data["applications"][0]["application_name"] == "web"


@pytest.mark.parametrize(
    ("text", "match"),
    [
        ("{not json", "invalid JSON"),
        ("[1, 2]", "JSON object"),
        ('{"sla_version": "v2.0"}', "no applications"),
        ('{"applications": []}', "no applications"),
        ('{"applications": ["web"]}', "must be an object"),
    ],
)
def test_load_existing_sla_rejects_unusable_input(text, match):
    with pytest.raises(ExistingSLAError, match=match):
        load_existing_sla(text)


def test_load_existing_sla_enforces_the_size_cap():
    with pytest.raises(ExistingSLAError, match="too large"):
        load_existing_sla(EXISTING_SLA_JSON + " " * MAX_SLA_CHARS)


def test_existing_sla_message_embeds_the_raw_json_verbatim():
    message = existing_sla_message(EXISTING_SLA_JSON)
    assert EXISTING_SLA_JSON.strip() in message
    assert "fails validation" not in message
    assert "will be dropped" not in message
    assert "Changes the user wants" not in message


def test_existing_sla_message_appends_notes_when_given():
    message = existing_sla_message(EXISTING_SLA_JSON, notes="  give nginx 2 cpus  ")
    assert message.endswith("Changes the user wants:\ngive nginx 2 cpus")


def test_existing_sla_message_lists_validation_problems():
    sla = json.loads(EXISTING_SLA_JSON)
    sla["applications"][0]["microservices"][0]["microservice_name"] = "way-too-long-name"

    message = existing_sla_message(json.dumps(sla))

    assert "fails validation" in message
    assert "way-too-long-name" in message


def test_unsupported_fields_lists_non_empty_fields_and_non_direct_constraints():
    sla = json.loads((_FIXTURES / "sla_correct_1.json").read_text())

    dropped = unsupported_fields(sla)

    ms = "applications[0].microservices[0]"
    assert f"{ms}.connectivity" in dropped
    assert f"{ms}.constraints[0] (type 'latency')" in dropped
    # Empty or zero values lose nothing, so they shouldn't turn into questions.
    assert "args" not in dropped
    assert f"{ms}.vtpus" not in dropped
    # IDs are blanked by to_oakestra_sla anyway.
    assert not any("ID" in path for path in dropped)


def test_unsupported_fields_lists_address_entries_other_than_rr_ip():
    sla = json.loads(EXISTING_SLA_JSON)
    sla["applications"][0]["microservices"][0]["addresses"] = {
        "rr_ip": "10.30.0.1",
        "rr_ip_v6": "fdff:2000::1",
    }

    dropped = unsupported_fields(sla)

    assert dropped == ["applications[0].microservices[0].addresses.rr_ip_v6"]


def test_unsupported_fields_is_empty_for_a_supported_sla():
    assert unsupported_fields(json.loads(EXISTING_SLA_JSON)) == []


def test_existing_sla_message_lists_dropped_fields():
    message = existing_sla_message((_FIXTURES / "sla_correct_1.json").read_text())
    assert "will be dropped" in message
    assert "connectivity" in message


def _sla_with_customer(customer_id):
    sla = json.loads(EXISTING_SLA_JSON)
    sla["customerID"] = customer_id
    return json.dumps(sla)


@pytest.mark.parametrize(
    ("explicit", "sla_text", "expected"),
    [
        ("acme", _sla_with_customer("uploaded"), "acme"),
        (None, _sla_with_customer("uploaded"), "uploaded"),
        ("   ", _sla_with_customer("uploaded"), "uploaded"),
        # Oakestra's schema used to make it an integer.
        (None, _sla_with_customer(10000000001), "10000000001"),
        (None, _sla_with_customer(""), "Admin"),
        (None, _sla_with_customer(True), "Admin"),
        (None, None, "Admin"),
        ("acme", None, "acme"),
    ],
)
def test_resolve_customer_id_prefers_explicit_then_uploaded_then_default(
    explicit, sla_text, expected
):
    assert resolve_customer_id(explicit, sla_text) == expected
