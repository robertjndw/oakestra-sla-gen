"""HTTP API around the generator and validator. Needs the `server` extra (FastAPI)."""

from collections.abc import Callable
from typing import Any, Literal

import openai
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, PrivateAttr, model_validator

from .compose import MAX_COMPOSE_CHARS, compose_message
from .existing_sla import MAX_SLA_CHARS, existing_sla_message, resolve_customer_id
from .generator import NeedsClarification, SLAGenerationError, generate_sla
from .validation import validate_sla


class GenerateRequest(BaseModel):
    description: str = ""
    compose: str | None = Field(default=None, max_length=MAX_COMPOSE_CHARS)
    # The raw JSON text rather than a parsed object, for the same reason as `compose`: image
    # names have to reach the LLM exactly as the user wrote them.
    sla: str | None = Field(default=None, max_length=MAX_SLA_CHARS)
    method: Literal["prompt", "json_schema", "function_calling"] = "prompt"
    # None (or blank) means "not chosen": an uploaded SLA's own customerID is kept then.
    customer_id: str | None = None
    # Capped so a single request can't keep a worker busy with an LLM for minutes.
    max_retries: int = Field(default=3, ge=1, le=10)
    _message: str = PrivateAttr()
    _customer_id: str = PrivateAttr()

    @model_validator(mode="after")
    def _require_description_or_input_file(self) -> "GenerateRequest":
        if self.compose is not None and self.sla is not None:
            raise ValueError("send either compose or sla, not both")
        if not self.description.strip() and not self.compose and not self.sla:
            raise ValueError("description, compose or sla is required")
        # Built here so the file is parsed once, and a ComposeError or ExistingSLAError (both
        # ValueErrors) is reported by pydantic as a regular 422.
        if self.compose is not None:
            self._message = compose_message(self.compose, self.description)
        elif self.sla is not None:
            self._message = existing_sla_message(self.sla, self.description)
        else:
            self._message = self.description
        self._customer_id = resolve_customer_id(self.customer_id, self.sla)
        return self

    def message(self) -> str:
        return self._message

    def resolved_customer_id(self) -> str:
        return self._customer_id


class GenerationFailure(BaseModel):
    detail: str
    errors: list[str]
    last_candidate: dict[str, Any] | None


class ClarificationNeeded(BaseModel):
    detail: str
    questions: list[dict[str, Any]]


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[str]


def create_app(
    structured_llm_factory: Callable[[str], Any],
    *,
    model: str | None = None,
) -> FastAPI:
    """Build the app around `structured_llm_factory(method)`.

    The LLM connection is set up once at startup, but `method` comes in with each
    request, so we need a factory rather than a ready-made runnable. Tests pass
    one that returns a fake.
    """
    app = FastAPI(
        title="oakestra-sla-gen",
        description="Generate a verified Oakestra SLA from a free-text description.",
    )

    @app.exception_handler(openai.APIError)
    def llm_error(_request: Request, error: openai.APIError) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": f"LLM server error: {error}"})

    # Don't make these `async def`. generate_sla blocks while waiting on the LLM, and
    # FastAPI only moves plain `def` endpoints off the event loop into a thread pool.
    @app.post(
        "/generate",
        responses={
            422: {"model": GenerationFailure, "description": "No valid SLA within max_retries"},
            502: {"description": "The LLM server could not be reached or returned an error"},
        },
    )
    def generate(request: GenerateRequest) -> dict[str, Any]:
        try:
            return generate_sla(
                request.message(),
                structured_llm=structured_llm_factory(request.method),
                customer_id=request.resolved_customer_id(),
                max_retries=request.max_retries,
            )
        except SLAGenerationError as error:
            failure = GenerationFailure(
                detail="could not produce a valid SLA",
                errors=error.errors,
                last_candidate=error.last_candidate,
            )
            return JSONResponse(status_code=422, content=failure.model_dump())
        except NeedsClarification as error:
            failure = ClarificationNeeded(
                detail="the description needs clarification before an SLA can be produced",
                questions=[q.model_dump() for q in error.questions],
            )
            return JSONResponse(status_code=422, content=failure.model_dump())

    @app.post("/validate")
    def validate(sla: dict[str, Any]) -> ValidateResponse:
        errors = validate_sla(sla)
        return ValidateResponse(valid=not errors, errors=errors)

    # Imported lazily: playground.py imports GenerateRequest back from this module, so
    # importing it at module scope here would be a circular import at load time.
    from .playground import add_playground

    add_playground(app, structured_llm_factory, model=model)

    return app
