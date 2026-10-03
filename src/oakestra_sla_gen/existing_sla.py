"""Turn an uploaded, existing SLA into the first human message of an SLA conversation."""

import json

from .compose import MAX_COMPOSE_CHARS
from .models import DEFAULT_CUSTOMER_ID, Addresses, Application, Microservice
from .prompts import EXISTING_SLA_TEMPLATE
from .validation import validate_sla

# Same budget as a compose file: plenty for a real SLA, small enough to keep the prompt sane.
MAX_SLA_CHARS = MAX_COMPOSE_CHARS

_TOP_LEVEL_FIELDS = {"sla_version", "customerID", "applications"}
# IDs are assigned by Oakestra and blanked again by `to_oakestra_sla`, so they aren't lost.
_APPLICATION_FIELDS = set(Application.model_fields) | {"applicationID"}
_MICROSERVICE_FIELDS = set(Microservice.model_fields) | {"microserviceID"}
_ADDRESS_FIELDS = set(Addresses.model_fields)


class ExistingSLAError(ValueError):
    """Raised when the given text isn't a usable SLA."""


def load_existing_sla(text: str) -> dict:
    """Only rejects what the model can't work from. An SLA that fails validation gets through,
    since getting it fixed is one reason to upload it."""
    if len(text) > MAX_SLA_CHARS:
        raise ExistingSLAError(f"SLA is too large (max {MAX_SLA_CHARS} characters)")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise ExistingSLAError(f"invalid JSON: {error}") from error
    if not isinstance(data, dict):
        raise ExistingSLAError("an SLA must be a JSON object at the top level")
    applications = data.get("applications")
    if not isinstance(applications, list) or not applications:
        raise ExistingSLAError("SLA has no applications")
    if not all(isinstance(application, dict) for application in applications):
        raise ExistingSLAError("every entry in applications must be an object")
    return data


def resolve_customer_id(explicit: str | None, sla_text: str | None) -> str:
    """An explicitly chosen ID wins, then the uploaded SLA's own customerID, then the default.

    Without the middle step every uploaded SLA would come back owned by Admin. Older SLAs carry
    it as an integer (Oakestra's schema used to say so), hence the str().
    """
    if explicit and explicit.strip():
        return explicit.strip()
    if sla_text is not None:
        uploaded = load_existing_sla(sla_text).get("customerID")
        if isinstance(uploaded, str | int) and not isinstance(uploaded, bool):
            if str(uploaded).strip():
                return str(uploaded).strip()
    return DEFAULT_CUSTOMER_ID


def _dropped(data: dict, allowed: set[str], path: str = "") -> list[str]:
    # Empty and zero values (`"args": []`, `"vtpus": 0`) are skipped: dropping them changes
    # nothing, but listing them would still get the model asking about each one.
    prefix = f"{path}." if path else ""
    return [f"{prefix}{key}" for key, value in data.items() if key not in allowed and value]


def unsupported_fields(sla: dict) -> list[str]:
    """Paths of fields the LLM's output model has no room for, so the draft will drop them.

    Listed for the model up front because it can't tell on its own which of Oakestra's fields
    we left out of `models.py`, and silently losing e.g. a latency constraint is worse than
    being asked about it.
    """
    paths = _dropped(sla, _TOP_LEVEL_FIELDS)
    for a, application in enumerate(sla.get("applications", [])):
        app_path = f"applications[{a}]"
        paths += _dropped(application, _APPLICATION_FIELDS, app_path)
        microservices = application.get("microservices")
        if not isinstance(microservices, list):
            continue
        for m, microservice in enumerate(microservices):
            if not isinstance(microservice, dict):
                continue
            ms_path = f"{app_path}.microservices[{m}]"
            paths += _dropped(microservice, _MICROSERVICE_FIELDS, ms_path)
            # `addresses` itself is supported, but only its rr_ip: Oakestra's IPv6 and
            # closest-IP entries would vanish without being listed otherwise.
            addresses = microservice.get("addresses")
            if isinstance(addresses, dict):
                paths += _dropped(addresses, _ADDRESS_FIELDS, f"{ms_path}.addresses")
            constraints = microservice.get("constraints")
            if isinstance(constraints, list):
                paths += [
                    f"{ms_path}.constraints[{c}] (type {constraint.get('type')!r})"
                    for c, constraint in enumerate(constraints)
                    if isinstance(constraint, dict) and constraint.get("type") != "direct"
                ]
    return paths


def existing_sla_message(text: str, notes: str = "") -> str:
    """Build the message that starts a session from an existing SLA plus optional notes.

    Embeds the raw text rather than re-dumping the parsed JSON so image names show up exactly
    as the user wrote them. `_image_mentioned_by_user` depends on that.
    """
    sla = load_existing_sla(text)
    message = f"{EXISTING_SLA_TEMPLATE}{text.strip()}\n```"
    if errors := validate_sla(sla):
        listed = "\n".join(f"- {error}" for error in errors)
        message += f"\n\nIt currently fails validation, fix these problems:\n{listed}"
    if dropped := unsupported_fields(sla):
        listed = "\n".join(f"- {path}" for path in dropped)
        message += (
            "\n\nThese fields can't be represented in your output and will be dropped. Raise a "
            f"question for each one whose loss changes how the application behaves:\n{listed}"
        )
    if notes.strip():
        message += f"\n\nChanges the user wants:\n{notes.strip()}"
    return message
