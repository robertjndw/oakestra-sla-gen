"""Interactive playground API: session routes around `SLASession`, mounted with `add_playground`.

The browser UI is the separate frontend/ app, which talks to these routes.

Kept separate from `server.py` because these routes hold per-session state in memory, while
the generate/validate API is stateless.
"""

import logging
import secrets
import threading
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Annotated, Any

import openai
from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .generator import Draft, SLAGenerationError, SLASession
from .server import GenerateRequest, GenerationFailure

logger = logging.getLogger(__name__)

# Each session holds its whole LLM conversation, so cap how many we keep around.
MAX_SESSIONS = 32
SESSION_TTL_SECONDS = 60.0 * 60.0

# Blocking turns are only in the progress store while their request is running, but async turns
# stay for a while after finishing so the client can fetch the result. The cap is a backstop;
# finished turns are evicted before running ones.
MAX_TURNS = 64
TURN_RESULT_TTL_SECONDS = 900.0

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


@dataclass
class _Turn:
    attempts: list[dict[str, Any]] = field(default_factory=list)
    status: int | None = None
    body: dict[str, Any] | None = None
    finished_at: float | None = None
    # Async turns keep their result for the TTL; blocking ones are dropped as soon as they end.
    retain: bool = False

    @property
    def done(self) -> bool:
        return self.finished_at is not None


def _wants_async(prefer: str | None) -> bool:
    """Whether a `Prefer` header (RFC 7240) asks for `respond-async`."""
    if not prefer:
        return False
    return any(
        part.split(";", 1)[0].strip().lower() == "respond-async" for part in prefer.split(",")
    )


def _execute_turn(
    session_id: str, turn: _Turn, run: Callable[[], Draft]
) -> tuple[int, dict[str, Any]]:
    """Run one LLM turn and map its outcome to the status and JSON body the routes return."""
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
        return 422, failure.model_dump() | {
            "attempts": turn.attempts,
            "session_id": session_id,
        }
    except openai.APIError as error:
        # Same shape as the app-wide handler in server.py, which can't see errors raised in a
        # background thread.
        return 502, {"detail": f"LLM server error: {error}"}
    except Exception:
        logger.exception("playground turn failed")
        return 500, {"detail": "internal error"}
    return 200, {
        "session_id": session_id,
        "sla": draft.sla,
        "questions": [q.model_dump() for q in draft.questions],
        "attempts": turn.attempts,
    }


def add_playground(
    app: FastAPI,
    structured_llm_factory: Callable[[str | None], Any],
    *,
    model: str | None = None,
    run_in_background: Callable[[Callable[[], None]], Any] | None = None,
) -> None:
    """Register the playground routes on `app`.

    Sessions live in this closure rather than in a module global so every app gets its own
    store. Otherwise tests would leak sessions into each other.

    `run_in_background` starts the worker for turns requested with `Prefer: respond-async`;
    by default they go to a thread pool. Tests pass `lambda fn: fn()` to run them inline.
    """
    sessions: dict[str, _Entry] = {}
    # Turns by the client's turn_id, for the progress route.
    turns: dict[str, _Turn] = {}
    store_lock = threading.Lock()
    if run_in_background is None:
        # One worker per session is enough: a session runs one turn at a time, and we never
        # keep more sessions than this.
        run_in_background = ThreadPoolExecutor(
            max_workers=MAX_SESSIONS, thread_name_prefix="playground"
        ).submit

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

    def expired_locked(turn: _Turn, now: float) -> bool:
        return turn.finished_at is not None and now - turn.finished_at > TURN_RESULT_TTL_SECONDS

    def register_turn(turn_id: str | None, turn: _Turn) -> bool:
        """Whether `turn` is now reachable under `turn_id`."""
        with store_lock:
            # A reused id keeps pointing at the turn that registered it first, so one client
            # can't redirect another's progress to its own turn.
            if turn_id is None:
                return False
            existing = turns.get(turn_id)
            if existing is not None and not expired_locked(existing, time.monotonic()):
                return False
            now = time.monotonic()
            for stale_id in [i for i, t in turns.items() if expired_locked(t, now)]:
                del turns[stale_id]
            while len(turns) >= MAX_TURNS:
                # Finished results go first, oldest first: a running turn still has a client
                # waiting on it. Dict order is registration order.
                finished = [i for i, t in turns.items() if t.done]
                if finished:
                    victim = min(finished, key=lambda i: turns[i].finished_at or 0.0)
                else:
                    victim = next(iter(turns))
                del turns[victim]
            turns[turn_id] = turn
            return True

    def drop_turn(turn_id: str | None, turn: _Turn) -> None:
        with store_lock:
            if turn_id is not None and turns.get(turn_id) is turn:
                del turns[turn_id]

    def finish_turn(turn_id: str | None, turn: _Turn, status: int, body: dict[str, Any]) -> None:
        with store_lock:
            turn.status = status
            turn.body = body
            turn.finished_at = time.monotonic()
            # Compared by identity: after a skipped duplicate or an eviction, the id may belong
            # to another turn that is still running.
            if not turn.retain and turn_id is not None and turns.get(turn_id) is turn:
                del turns[turn_id]

    def run_turn(
        session_id: str,
        entry: _Entry,
        turn_id: str | None,
        run: Callable[[], Draft],
        respond_async: bool,
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
        turn = _Turn(retain=respond_async)
        # Registered before any worker starts so the first poll can't beat it to a 404.
        if not register_turn(turn_id, turn) and respond_async:
            # No id, or the client's id still names another turn. An async client only learns
            # the outcome through the id in the 202, so it needs an id of its own.
            turn_id = secrets.token_hex(16)
            register_turn(turn_id, turn)

        def work() -> tuple[int, dict[str, Any]]:
            entry.session.on_attempt = lambda attempt, errors: turn.attempts.append(
                {"attempt": attempt, "errors": list(errors)}
            )
            try:
                status, body = _execute_turn(session_id, turn, run)
                finish_turn(turn_id, turn, status, body)
                return status, body
            finally:
                entry.session.on_attempt = None
                # Released here, possibly on another thread than the one that took it, which
                # a plain Lock allows.
                entry.lock.release()

        if not respond_async:
            status, body = work()
            return body if status == 200 else JSONResponse(status_code=status, content=body)

        def job() -> None:
            work()

        try:
            run_in_background(job)
        except BaseException:
            # The worker never started, so nothing else will release the lock or finish the
            # turn, which would otherwise sit in the store as running until evicted.
            drop_turn(turn_id, turn)
            entry.lock.release()
            raise
        return JSONResponse(
            status_code=202,
            content={"session_id": session_id, "turn_id": turn_id},
            headers={"Preference-Applied": "respond-async"},
        )

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
    def start_session(
        request: StartSessionRequest, prefer: Annotated[str | None, Header()] = None
    ) -> Any:
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
            session_id,
            entry,
            request.turn_id,
            lambda: session.start(request.message()),
            _wants_async(prefer),
        )

    @app.post("/playground/sessions/{session_id}/answer")
    def answer_session(
        session_id: str, request: AnswerRequest, prefer: Annotated[str | None, Header()] = None
    ) -> Any:
        entry = get_entry(session_id)
        return run_turn(
            session_id,
            entry,
            request.turn_id,
            lambda: entry.session.answer(request.text),
            _wants_async(prefer),
        )

    # Polled by the UI while a turn is running, since local models can take minutes per turn.
    # For blocking turns, not knowing a turn is the normal answer before its POST arrives and
    # after it finished, so the client keeps the last progress it saw and relies on the POST
    # for the outcome. Async turns report their result here until it expires.
    @app.get(
        "/playground/turns/{turn_id}",
        responses={404: {"description": "the turn is unknown, finished (blocking) or expired"}},
    )
    # `async def` on purpose, unlike the routes around it: it never blocks for long, and in the
    # thread pool it would queue behind the very LLM turns it reports on once those fill it.
    async def turn_progress(turn_id: str) -> dict[str, Any]:
        with store_lock:
            turn = turns.get(turn_id)
            if turn is not None and expired_locked(turn, time.monotonic()):
                del turns[turn_id]
                turn = None
            if turn is None:
                raise HTTPException(status_code=404, detail="unknown turn")
            # Copied because the turn's thread keeps appending while this gets serialized.
            attempts = list(turn.attempts)
            if not turn.done:
                # Blocking turns keep their original shape; only async clients look at `done`.
                return (
                    {"attempts": attempts, "done": False} if turn.retain else {"attempts": attempts}
                )
            return {
                "attempts": attempts,
                "done": True,
                "status": turn.status,
                "result": turn.body,
            }

    @app.delete("/playground/sessions/{session_id}", status_code=204)
    def delete_session(session_id: str) -> Response:
        with store_lock:
            sessions.pop(session_id, None)
        return Response(status_code=204)
