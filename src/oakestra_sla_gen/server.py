"""HTTP API around the generator and validator. Needs the `server` extra (FastAPI)."""

from collections.abc import Callable
from typing import Any, Literal

import openai
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .generator import NeedsClarification, SLAGenerationError, generate_sla
from .validation import validate_sla


class GenerateRequest(BaseModel):
    description: str = Field(min_length=1)
    method: Literal["prompt", "json_schema", "function_calling"] = "prompt"
    customer_id: str = "Admin"
    # Capped so a single request can't keep a worker busy with an LLM for minutes.
    max_retries: int = Field(default=3, ge=1, le=10)


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
    playground: bool = False,
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
                request.description,
                structured_llm=structured_llm_factory(request.method),
                customer_id=request.customer_id,
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
        except openai.APIError as error:
            return JSONResponse(status_code=502, content={"detail": f"LLM server error: {error}"})

    @app.post("/validate")
    def validate(sla: dict[str, Any]) -> ValidateResponse:
        errors = validate_sla(sla)
        return ValidateResponse(valid=not errors, errors=errors)

    if playground:
        # Imported lazily: playground.py imports GenerateRequest back from this module, so
        # importing it at module scope here would be a circular import at load time.
        from .playground import add_playground

        add_playground(app, structured_llm_factory, model=model)

    return app
