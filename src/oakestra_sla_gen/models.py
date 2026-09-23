"""Pydantic models that constrain what the LLM is allowed to produce.

This is a practical subset of Oakestra's SLA: the fields the schedulers
actually read (`vcpus`, `memory`, `virtualization`, `direct` constraints) plus
the identity fields Oakestra requires. Fields like latency/geo constraints,
volumes, or connectivity exist in the real schema but are parsed and ignored
by the scheduler, so we don't ask the LLM to guess at them.

Name fields use `^[a-zA-Z0-9]{1,10}$`: the docs describe a 10 character limit
even though Oakestra's own JSON Schema allows up to 32. We apply the stricter
of the two so the output satisfies both.
"""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Reject unrecognized fields rather than silently drop them: since the LLM's
# output is constrained to this schema, an unknown field is a sign it used the
# wrong name (e.g. the docs' "vcpu" instead of the real "vcpus") and we want
# that to surface as an error, not vanish.
_STRICT = ConfigDict(extra="forbid")

NAME_PATTERN = r"^[a-zA-Z0-9]{1,10}$"
ENV_PATTERN = r"^[A-Za-z_][A-Za-z0-9_]*=.*$"
# host:container[/tcp|udp], multiple mappings separated by ';', e.g. "80:80;443:443/tcp"
# Oakestra's service IP range; any 10.30.X.Y the user picks is load-balanced
# round-robin across the service's instances.
RR_IP_PATTERN = r"^10\.30\.\d{1,3}\.\d{1,3}$"
PORT_PATTERN = r"^\d{1,5}:\d{1,5}(/(tcp|udp))?(;\d{1,5}:\d{1,5}(/(tcp|udp))?)*$"


class Addresses(BaseModel):
    model_config = _STRICT

    rr_ip: str = Field(
        pattern=RR_IP_PATTERN,
        description="Service IP (10.30.X.Y) other microservices use to reach this one.",
    )


class DirectConstraint(BaseModel):
    """Pin a microservice to a specific node or cluster.

    Latency and geo constraints exist in Oakestra's schema but the scheduler
    never reads them, so we only model the constraint type it acts on.
    """

    model_config = _STRICT

    type: Literal["direct"] = "direct"
    node: str | None = Field(default=None, description="Exact node name to run on, if any.")
    cluster: str | None = Field(default=None, description="Exact cluster name to run on, if any.")

    @model_validator(mode="after")
    def _require_target(self) -> "DirectConstraint":
        if not self.node and not self.cluster:
            raise ValueError("a direct constraint needs a node or a cluster")
        return self


class Microservice(BaseModel):
    model_config = _STRICT

    microservice_name: str = Field(
        pattern=NAME_PATTERN,
        description="Short alphanumeric name, 1-10 characters, unique within the application.",
    )
    microservice_namespace: str = Field(
        pattern=NAME_PATTERN,
        description="Short alphanumeric namespace, 1-10 characters.",
    )
    virtualization: Literal["container", "unikernel"] = Field(
        default="container",
        description="Runtime for this microservice.",
    )
    code: str = Field(
        description="Fully qualified image reference, e.g. docker.io/library/nginx:latest.",
    )
    cmd: list[str] = Field(
        default_factory=list,
        description="Command override, one argument per entry. Leave empty for the image default.",
    )
    environment: list[str] = Field(
        default_factory=list,
        description="Environment variables as KEY=value strings.",
        # each entry is validated as a whole string below since Pydantic can't
        # apply a str pattern to list items directly
    )
    port: str | None = Field(
        default=None,
        pattern=PORT_PATTERN,
        description=(
            "Port mappings as host:container, optionally with /tcp or /udp, "
            "multiple mappings separated by ';'. E.g. '80:80' or '443:443/tcp;53:53/udp'."
        ),
    )
    vcpus: int = Field(default=1, ge=1, description="Virtual CPUs to allocate.")
    vgpus: int = Field(default=0, ge=0, description="Virtual GPUs to allocate.")
    memory: int = Field(default=100, ge=1, description="Memory in megabytes (MB).")
    storage: int = Field(default=0, ge=0, description="Disk storage in megabytes (MB).")
    constraints: list[DirectConstraint] = Field(
        default_factory=list,
        description="Only set when the user names a specific node or cluster.",
    )
    addresses: Addresses | None = Field(
        default=None,
        description="Only set when another microservice needs to connect to this one.",
    )

    @model_validator(mode="after")
    def _check_environment(self) -> "Microservice":
        for entry in self.environment:
            if not re.match(ENV_PATTERN, entry):
                raise ValueError(f"environment entry {entry!r} must look like KEY=value")
        return self


class Application(BaseModel):
    model_config = _STRICT

    application_name: str = Field(
        pattern=NAME_PATTERN,
        description="Short alphanumeric name, 1-10 characters.",
    )
    application_namespace: str = Field(
        pattern=NAME_PATTERN,
        description="Short alphanumeric namespace, 1-10 characters.",
    )
    application_desc: str = Field(default="", description="Human readable description.")
    microservices: list[Microservice] = Field(min_length=1)


class Clarification(BaseModel):
    """An open question about a part of the draft, for the user to resolve."""

    model_config = _STRICT

    topic: str = Field(description="Which part this concerns, e.g. 'mysql image'.")
    question: str
    assumption: str | None = Field(
        default=None,
        description="What the draft currently assumes for this, or null if nothing could be.",
    )


class SLARequest(BaseModel):
    """What the LLM produces. `to_oakestra_sla` wraps this into a full SLA document."""

    model_config = _STRICT

    applications: list[Application] = Field(
        default_factory=list,
        description="Empty when the description is too vague to draft anything.",
    )
    questions: list[Clarification] = Field(
        default_factory=list,
        description=(
            "Open questions about parts of the draft you're unsure about, each with the "
            "assumption the draft makes (or null). Use this for anything uncertain enough "
            "to matter, and as the only content when there isn't enough to draft an SLA at "
            "all."
        ),
    )

    @model_validator(mode="after")
    def _require_applications_or_questions(self) -> "SLARequest":
        if not self.applications and not self.questions:
            raise ValueError("must include at least one application or one question")
        return self

    def to_oakestra_sla(self, customer_id: str = "Admin") -> dict:
        """Wrap the LLM's output into the document shape Oakestra expects.

        `microserviceID` must be an empty string (Oakestra's schema requires
        maxLength 0) and `applicationID` is assigned by Oakestra itself, so
        both are left blank here.
        """
        if not self.applications:
            raise ValueError("to_oakestra_sla requires at least one application")
        sla = self.model_dump(mode="json", exclude_none=True, exclude={"questions"})
        for application in sla["applications"]:
            application["applicationID"] = ""
            for microservice in application["microservices"]:
                microservice["microserviceID"] = ""
        return {
            "sla_version": "v2.0",
            "customerID": customer_id,
            **sla,
        }
