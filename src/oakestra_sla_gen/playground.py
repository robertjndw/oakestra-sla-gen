"""Interactive playground API: session routes around `SLASession`, mounted with `add_playground`.

The browser UI is the separate frontend/ app, which talks to these routes.

Kept separate from `server.py` because these routes hold per-session state in memory, while
the generate/validate API is stateless.
"""

import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .generator import Draft, SLAGenerationError, SLASession
from .server import GenerateRequest, GenerationFailure

# Each session holds its whole LLM conversation, so cap how many we keep around.
MAX_SESSIONS = 32
SESSION_TTL_SECONDS = 60.0 * 60.0

# A turn is only in the progress store while its request is running, so the store can't
# outgrow the worker thread pool (40 threads by default). The cap is only a backstop, and
# evicting a turn loses its live progress but not its result.
MAX_TURNS = 64

# The UI sends 32 random hex characters. Knowing the id is all it takes to read a turn's errors, so
# it has to be unguessable; the pattern only keeps it short and URL-safe for the progress route.
TurnId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")]


class StartSessionRequest(GenerateRequest):
    check_images: bool = True
    turn_id: TurnId | None = None


class AnswerRequest(BaseModel):
    text: str = Field(min_length=1)
    turn_id: TurnId | None = None


@dataclass
class _Entry:
    session: SLASession
    lock: threading.Lock
    last_used: float


def add_playground(
    app: FastAPI, structured_llm_factory: Callable[[str | None], Any], *, model: str | None = None
) -> None:
    """Register the playground routes on `app`.

    Sessions live in this closure rather than in a module global so every app gets its own
    store. Otherwise tests would leak sessions into each other.
    """
    sessions: dict[str, _Entry] = {}
    # Attempts of the turns still running, by the client's turn_id, for the progress route.
    turns: dict[str, list[dict[str, Any]]] = {}
    store_lock = threading.Lock()

    def evict_locked() -> None:
        now = time.monotonic()
        expired = [
            session_id
            for session_id, entry in sessions.items()
            if now - entry.last_used > SESSION_TTL_SECONDS
        ]
        for session_id in expired:
            del sessions[session_id]
        while len(sessions) >= MAX_SESSIONS:
            oldest = min(sessions, key=lambda session_id: sessions[session_id].last_used)
            del sessions[oldest]

    def insert(session_id: str, entry: _Entry) -> None:
        with store_lock:
            evict_locked()
            sessions[session_id] = entry

    def get_entry(session_id: str) -> _Entry:
        with store_lock:
            entry = sessions.get(session_id)
        if entry is None:
            raise HTTPException(status_code=404, detail="unknown session")
        return entry

    def register_turn(turn_id: str | None, attempts: list[dict[str, Any]]) -> None:
        with store_lock:
            # A reused id keeps pointing at the turn that registered it first, so one client
            # can't redirect another's progress to its own turn.
            if turn_id is None or turn_id in turns:
                return
            while len(turns) >= MAX_TURNS:
                del turns[next(iter(turns))]
            turns[turn_id] = attempts

    def unregister_turn(turn_id: str | None, attempts: list[dict[str, Any]]) -> None:
        with store_lock:
            # Compared by identity: after a skipped duplicate or an eviction, the id may belong
            # to another turn that is still running.
            if turn_id is not None and turns.get(turn_id) is attempts:
                del turns[turn_id]

    def run_turn(
        session_id: str, entry: _Entry, turn_id: str | None, run: Callable[[], Draft]
    ) -> Any:
        # Non-blocking: a second request for the same session while one is in flight should
        # fail fast rather than queue up behind a minute-long LLM call.
        if not entry.lock.acquire(blocking=False):
            raise HTTPException(
                status_code=409, detail="a turn is already running for this session"
            )
        # Bumped when the turn starts: a session stuck in a slow turn, or one whose last turn
        # failed, is still in use and shouldn't be the first one evicted.
        entry.last_used = time.monotonic()
        attempts: list[dict[str, Any]] = []
        entry.session.on_attempt = lambda attempt, errors: attempts.append(
            {"attempt": attempt, "errors": list(errors)}
        )
        register_turn(turn_id, attempts)
        try:
            draft = run()
        except SLAGenerationError as error:
            # The session itself is still usable - `SLASession._turn` only commits to
            # `messages`/`user_texts`/`draft` on success - so the caller can answer and try again.
            failure = GenerationFailure(
                detail="could not produce a valid SLA",
                errors=error.errors,
                last_candidate=error.last_candidate,
            )
            return JSONResponse(
                status_code=422,
                content=failure.model_dump() | {"attempts": attempts, "session_id": session_id},
            )
        else:
            return {
                "session_id": session_id,
                "sla": draft.sla,
                "questions": [q.model_dump() for q in draft.questions],
                "attempts": attempts,
            }
        finally:
            unregister_turn(turn_id, attempts)
            entry.session.on_attempt = None
            entry.lock.release()

    # The UI shows which model it's talking to, since comparing models is most of what the
    # playground gets used for.
    @app.get("/playground/info")
    def playground_info() -> dict[str, Any]:
        return {"model": model}

    # This and the answer route stay plain `def`, not `async def`, for the same reason as the
    # routes in server.py: FastAPI runs them in its thread pool instead of blocking the event
    # loop on the LLM call.
    @app.post(
        "/playground/sessions",
        responses={
            422: {"description": "no valid SLA within max_retries"},
            502: {"description": "the LLM server could not be reached or returned an error"},
        },
    )
    def start_session(request: StartSessionRequest) -> Any:
        session_id = uuid.uuid4().hex
        session = SLASession(
            structured_llm=structured_llm_factory(request.method),
            customer_id=request.resolved_customer_id(),
            max_retries=request.max_retries,
            check_images=request.check_images,
        )
        entry = _Entry(session=session, lock=threading.Lock(), last_used=time.monotonic())
        insert(session_id, entry)
        return run_turn(
            session_id, entry, request.turn_id, lambda: session.start(request.message())
        )

    @app.post("/playground/sessions/{session_id}/answer")
    def answer_session(session_id: str, request: AnswerRequest) -> Any:
        entry = get_entry(session_id)
        return run_turn(
            session_id, entry, request.turn_id, lambda: entry.session.answer(request.text)
        )

    # Polled by the UI while a turn's POST is still open, since local models can take minutes
    # per turn. Polling rather than streaming keeps the session routes' responses as they are.
    # Not knowing a turn is the normal answer before its POST arrives and after it finished,
    # so the client keeps the last progress it saw and relies on the POST for the outcome.
    @app.get(
        "/playground/turns/{turn_id}",
        responses={404: {"description": "the turn is unknown or already finished"}},
    )
    # `async def` on purpose, unlike the routes around it: it never blocks for long, and in the
    # thread pool it would queue behind the very LLM turns it reports on once those fill it.
    async def turn_progress(turn_id: str) -> dict[str, Any]:
        with store_lock:
            attempts = turns.get(turn_id)
            # Copied because the turn's thread keeps appending while this gets serialized.
            snapshot = list(attempts) if attempts is not None else None
        if snapshot is None:
            raise HTTPException(status_code=404, detail="unknown turn")
        return {"attempts": snapshot}

    @app.delete("/playground/sessions/{session_id}", status_code=204)
    def delete_session(session_id: str) -> Response:
        with store_lock:
            sessions.pop(session_id, None)
        return Response(status_code=204)
