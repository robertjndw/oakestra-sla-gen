"""Command line interface: generate an SLA from free text, validate one, or serve over HTTP."""

import argparse
import json
import os
import pathlib
import sys

from .generator import (
    DEFAULT_MODEL,
    DEFAULT_REASONING_EFFORT,
    SLAGenerationError,
    SLASession,
    build_llm,
    build_structured_llm,
    format_question,
)
from .models import Clarification
from .validation import validate_sla


def _add_llm_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--base-url", default=os.environ.get("OPENAI_BASE_URL", "http://127.0.0.1:1234/v1")
    )
    parser.add_argument("--model", default=os.environ.get("OAKESTRA_SLA_MODEL", DEFAULT_MODEL))
    parser.add_argument("--api-key", default=os.environ.get("OPENAI_API_KEY", "lm-studio"))
    parser.add_argument(
        "--reasoning-effort",
        choices=["low", "medium", "high"],
        default=DEFAULT_REASONING_EFFORT,
    )


def _format_microservice_line(microservice: dict) -> str:
    bits = [microservice.get("microservice_name", "?"), microservice.get("code", "?")]
    if microservice.get("port"):
        bits.append(f"port {microservice['port']}")
    bits.append(f"{microservice.get('vcpus', 1)} vcpu / {microservice.get('memory', 0)}MB")

    extra = []
    rr_ip = (microservice.get("addresses") or {}).get("rr_ip")
    if rr_ip:
        extra.append(f"rr_ip {rr_ip}")
    for constraint in microservice.get("constraints") or []:
        target = constraint.get("node") or constraint.get("cluster")
        extra.append(f"constraint {target}")
    if extra:
        bits.append(", ".join(extra))

    return " - ".join(bits)


def _print_draft_summary(sla: dict | None) -> None:
    if not sla:
        return
    for application in sla.get("applications", []):
        for microservice in application.get("microservices", []):
            print(f"  {_format_microservice_line(microservice)}", file=sys.stderr)


def _print_questions(questions: list[Clarification]) -> None:
    for i, question in enumerate(questions, 1):
        print(f"{i}. {format_question(question)}", file=sys.stderr)


class _Aborted(Exception):
    """The user typed 'q' at the interactive prompt."""


def _working() -> None:
    # A local reasoning model can take a minute or more per round; without this the
    # prompt just sits there looking hung.
    print("working on the draft...", file=sys.stderr, flush=True)


def _run_interactive(session: SLASession, description: str):
    _working()
    draft = session.start(description)
    while True:
        _print_draft_summary(draft.sla)
        if not draft.questions:
            return draft
        _print_questions(draft.questions)
        try:
            answer = input("answer (Enter to accept, q to quit)> ")
        except EOFError:
            raise _Aborted from None

        stripped = answer.strip()
        if stripped.lower() == "q":
            raise _Aborted
        if not stripped:
            if draft.sla is not None:
                return draft
            print("an answer is needed - there's nothing to accept yet", file=sys.stderr)
            continue
        _working()
        draft = session.answer(answer)


def _generate_command(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="oakestra-sla-gen",
        description="Generate a verified Oakestra SLA from a free-text description.",
    )
    parser.add_argument("text", nargs="?", help="Free-text description of the application(s).")
    parser.add_argument("-f", "--file", help="Read the description from a file.")
    parser.add_argument("-o", "--output", help="Write the verified SLA here instead of stdout.")
    _add_llm_arguments(parser)
    parser.add_argument(
        "--method", choices=["prompt", "json_schema", "function_calling"], default="prompt"
    )
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--customer-id", default="Admin")
    parser.add_argument(
        "--no-image-check",
        action="store_true",
        help="Don't check that referenced images exist in their registry.",
    )
    parser.add_argument(
        "--no-interactive",
        action="store_true",
        help="Never prompt; print the SLA (if any) and any questions/assumptions, then exit.",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Log each attempt and its errors to stderr."
    )
    args = parser.parse_args(argv)

    if args.file:
        description = pathlib.Path(args.file).read_text()
    elif args.text:
        description = args.text
    elif not sys.stdin.isatty():
        description = sys.stdin.read()
    else:
        parser.error("provide a description, -f FILE, or pipe one in on stdin")

    interactive = not args.no_interactive and sys.stdin.isatty() and sys.stderr.isatty()

    def on_attempt(attempt: int, errors: list[str]) -> None:
        if not args.verbose:
            return
        if errors:
            print(f"attempt {attempt}: {len(errors)} error(s)", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
        else:
            print(f"attempt {attempt}: verified", file=sys.stderr)

    try:
        llm = build_llm(
            base_url=args.base_url,
            model=args.model,
            api_key=args.api_key,
            reasoning_effort=args.reasoning_effort,
        )
        session = SLASession(
            llm=llm,
            method=args.method,
            customer_id=args.customer_id,
            max_retries=args.max_retries,
            check_images=not args.no_image_check,
            on_attempt=on_attempt,
        )
        if interactive:
            try:
                draft = _run_interactive(session, description)
            except _Aborted:
                print("aborted", file=sys.stderr)
                return 1
        else:
            draft = session.start(description)
    except SLAGenerationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    except Exception as error:  # connection errors, bad base URL, etc.
        print(f"error: {error}", file=sys.stderr)
        return 2

    if draft.sla is None:
        _print_questions(draft.questions)
        return 3

    if draft.questions:
        print("Assumptions made:", file=sys.stderr)
        _print_questions(draft.questions)

    output = json.dumps(draft.sla, indent=2)
    if args.output:
        pathlib.Path(args.output).write_text(output + "\n")
    else:
        print(output)
    return 0


def _validate_command(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="oakestra-sla-gen validate", description="Validate an existing SLA file."
    )
    parser.add_argument("file")
    args = parser.parse_args(argv)

    try:
        sla = json.loads(pathlib.Path(args.file).read_text())
    except (OSError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    errors = validate_sla(sla)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print("valid")
    return 0


def _serve_command(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="oakestra-sla-gen serve", description="Serve the generator over HTTP."
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    _add_llm_arguments(parser)
    args = parser.parse_args(argv)

    # Imported here so the CLI keeps working when the `server` extra isn't installed.
    try:
        import uvicorn

        from .server import create_app
    except ImportError as error:
        print(
            f"error: {error}\n"
            "the server needs the `server` extra: "
            "pip install 'oakestra-sla-gen[server]' or uv sync --extra server",
            file=sys.stderr,
        )
        return 2

    llm = build_llm(
        base_url=args.base_url,
        model=args.model,
        api_key=args.api_key,
        reasoning_effort=args.reasoning_effort,
    )
    app = create_app(lambda method: build_structured_llm(llm, method=method))
    uvicorn.run(app, host=args.host, port=args.port)
    return 0


def main() -> None:
    argv = sys.argv[1:]
    if argv and argv[0] == "validate":
        sys.exit(_validate_command(argv[1:]))
    if argv and argv[0] == "serve":
        sys.exit(_serve_command(argv[1:]))
    sys.exit(_generate_command(argv))
