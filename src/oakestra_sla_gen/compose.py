"""Turn an uploaded Docker Compose file into the first human message of an SLA conversation."""

import yaml

from .prompts import COMPOSE_TEMPLATE

# Far more than any real compose file needs, but keeps one upload from blowing up the prompt.
MAX_COMPOSE_CHARS = 64_000


class ComposeError(ValueError):
    """Raised when the given text isn't a usable compose file."""


def load_compose(text: str) -> dict:
    """Just enough checking to reject junk before it reaches the LLM, which does the actual
    translation."""
    if len(text) > MAX_COMPOSE_CHARS:
        raise ComposeError(f"compose file is too large (max {MAX_COMPOSE_CHARS} characters)")
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as error:
        raise ComposeError(f"invalid YAML: {error}") from error
    if not isinstance(data, dict):
        raise ComposeError("a compose file must be a YAML mapping at the top level")
    services = data.get("services")
    if not isinstance(services, dict) or not services:
        raise ComposeError("compose file has no services")
    return data


def compose_message(text: str, notes: str = "") -> str:
    """Build the message that starts a session from a compose file plus optional notes.

    Uses the raw text instead of re-dumping the parsed YAML so image names show up exactly as
    the user wrote them. `_image_mentioned_by_user` depends on that.
    """
    load_compose(text)
    message = f"{COMPOSE_TEMPLATE}{text}\n```"
    if notes.strip():
        message += f"\n\nAdditional instructions from the user:\n{notes.strip()}"
    return message
