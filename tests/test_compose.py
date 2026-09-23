"""Tests for parsing and templating an uploaded docker compose file."""

import pytest

from oakestra_sla_gen.compose import MAX_COMPOSE_CHARS, ComposeError, compose_message, load_compose

_VALID = """\
services:
  web:
    image: nginx:1.25
    ports:
      - "8080:80"
"""


def test_load_compose_accepts_a_valid_file():
    data = load_compose(_VALID)

    assert data["services"]["web"]["image"] == "nginx:1.25"


def test_load_compose_rejects_invalid_yaml():
    with pytest.raises(ComposeError, match="invalid YAML"):
        load_compose("services: [unterminated")


def test_load_compose_rejects_a_list_top_level():
    with pytest.raises(ComposeError, match="mapping"):
        load_compose("- web\n- db\n")


def test_load_compose_rejects_missing_services():
    with pytest.raises(ComposeError, match="no services"):
        load_compose("name: myapp\n")


def test_load_compose_rejects_empty_services():
    with pytest.raises(ComposeError, match="no services"):
        load_compose("services: {}\n")


def test_load_compose_rejects_non_mapping_services():
    with pytest.raises(ComposeError, match="no services"):
        load_compose("services: [web, db]\n")


def test_load_compose_enforces_the_size_cap():
    huge = "services:\n  web:\n    image: nginx\n" + "#" * MAX_COMPOSE_CHARS

    with pytest.raises(ComposeError, match="too large"):
        load_compose(huge)


def test_compose_message_embeds_the_raw_yaml_verbatim():
    message = compose_message(_VALID)

    assert _VALID in message


def test_compose_message_has_no_notes_section_when_notes_are_blank():
    assert "Additional instructions" not in compose_message(_VALID)
    assert "Additional instructions" not in compose_message(_VALID, notes="   ")


def test_compose_message_appends_notes_when_given():
    message = compose_message(_VALID, notes="pin web to cluster edge1")

    assert "Additional instructions from the user:" in message
    assert "pin web to cluster edge1" in message


def test_compose_message_rejects_invalid_compose():
    with pytest.raises(ComposeError):
        compose_message("services: {}\n")
