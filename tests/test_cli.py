"""CLI tests with a fake session, no network or real TTY involved."""

import pytest

from oakestra_sla_gen import cli
from oakestra_sla_gen.generator import Draft
from oakestra_sla_gen.models import Clarification

_NGINX_SLA = {
    "sla_version": "v2.0",
    "customerID": "Admin",
    "applications": [
        {
            "application_name": "web",
            "application_namespace": "default",
            "applicationID": "",
            "microservices": [
                {
                    "microservice_name": "nginx",
                    "microservice_namespace": "default",
                    "microserviceID": "",
                    "virtualization": "container",
                    "code": "docker.io/library/nginx:latest",
                    "vcpus": 1,
                    "memory": 128,
                }
            ],
        }
    ],
}


class FakeSession:
    """Stands in for `SLASession`: returns each of `drafts` in order and records calls."""

    def __init__(self, drafts):
        self.drafts = list(drafts)
        self.calls: list[tuple[str, str]] = []

    def start(self, description):
        self.calls.append(("start", description))
        return self.drafts.pop(0)

    def answer(self, text):
        self.calls.append(("answer", text))
        return self.drafts.pop(0)


def _patch_session(monkeypatch, drafts):
    fake = FakeSession(drafts)
    monkeypatch.setattr(cli, "SLASession", lambda **kwargs: fake)
    return fake


# -- non-interactive CLI path -------------------------------------------------


def test_no_interactive_exits_3_and_prints_questions_when_no_sla(monkeypatch, capsys):
    draft = Draft(
        sla=None,
        questions=[Clarification(topic="application", question="what should be deployed?")],
    )
    _patch_session(monkeypatch, [draft])

    code = cli._generate_command(["deploy my app", "--no-interactive"])

    assert code == 3
    out, err = capsys.readouterr()
    assert out == ""
    assert "what should be deployed?" in err


def test_no_interactive_prints_sla_and_assumptions(monkeypatch, capsys):
    draft = Draft(
        sla=_NGINX_SLA,
        questions=[
            Clarification(topic="nginx memory", question="enough memory?", assumption="128MB")
        ],
    )
    _patch_session(monkeypatch, [draft])

    code = cli._generate_command(["nginx", "--no-interactive"])

    assert code == 0
    out, err = capsys.readouterr()
    assert '"microservice_name": "nginx"' in out
    assert "Assumptions made:" in err
    assert "enough memory? (assuming: 128MB)" in err


def test_no_interactive_success_without_questions_has_no_assumptions_output(monkeypatch, capsys):
    draft = Draft(sla=_NGINX_SLA, questions=[])
    _patch_session(monkeypatch, [draft])

    code = cli._generate_command(["nginx", "--no-interactive"])

    assert code == 0
    out, err = capsys.readouterr()
    assert "Assumptions made:" not in err
    assert '"microservice_name": "nginx"' in out


# -- interactive loop ----------------------------------------------------------


def test_interactive_loop_accepts_immediately_when_no_questions():
    draft = Draft(sla=_NGINX_SLA, questions=[])
    session = FakeSession([draft])

    result = cli._run_interactive(session, "nginx")

    assert result is draft
    assert session.calls == [("start", "nginx")]


def test_interactive_loop_answers_then_accepts(monkeypatch):
    draft1 = Draft(
        sla=None, questions=[Clarification(topic="application", question="which image?")]
    )
    draft2 = Draft(sla=_NGINX_SLA, questions=[])
    session = FakeSession([draft1, draft2])
    answers = iter(["use nginx"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(answers))

    result = cli._run_interactive(session, "deploy something")

    assert result is draft2
    assert session.calls == [("start", "deploy something"), ("answer", "use nginx")]


def test_interactive_loop_empty_input_requires_answer_before_first_sla(monkeypatch, capsys):
    draft1 = Draft(
        sla=None, questions=[Clarification(topic="application", question="which image?")]
    )
    draft2 = Draft(sla=_NGINX_SLA, questions=[])
    session = FakeSession([draft1, draft2])
    answers = iter(["", "nginx please"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(answers))

    result = cli._run_interactive(session, "deploy something")

    assert result is draft2
    err = capsys.readouterr().err
    assert "answer is needed" in err


def test_interactive_loop_accepts_current_sla_on_empty_input(monkeypatch):
    draft = Draft(
        sla=_NGINX_SLA,
        questions=[Clarification(topic="nginx memory", question="enough?", assumption="128MB")],
    )
    session = FakeSession([draft])
    monkeypatch.setattr("builtins.input", lambda prompt="": "")

    result = cli._run_interactive(session, "nginx")

    assert result is draft
    assert session.calls == [("start", "nginx")]


def test_interactive_loop_q_aborts(monkeypatch):
    draft = Draft(sla=None, questions=[Clarification(topic="application", question="which image?")])
    session = FakeSession([draft])
    monkeypatch.setattr("builtins.input", lambda prompt="": "q")

    with pytest.raises(cli._Aborted):
        cli._run_interactive(session, "deploy something")


# -- serve --------------------------------------------------------------------


def test_serve_playground_flag_and_reasoning_effort(monkeypatch, capsys):
    # serve builds an LLM too, so it needs --reasoning-effort just like generation does.
    import uvicorn

    captured = {}
    monkeypatch.setattr(
        cli, "build_llm", lambda **kwargs: captured.setdefault("build_llm_kwargs", kwargs)
    )
    monkeypatch.setattr(
        uvicorn,
        "run",
        lambda app, host, port: captured.update(app=app, host=host, port=port),
    )

    code = cli._serve_command(["--playground", "--reasoning-effort", "high"])

    assert code == 0
    assert captured["build_llm_kwargs"]["reasoning_effort"] == "high"
    assert captured["host"] == "127.0.0.1"
    assert captured["port"] == 8000
    assert "/playground" in [route.path for route in captured["app"].routes]
    assert "playground at http://127.0.0.1:8000/playground" in capsys.readouterr().err


def test_serve_without_playground_flag_skips_playground_routes(monkeypatch):
    import uvicorn

    captured = {}
    monkeypatch.setattr(cli, "build_llm", lambda **kwargs: object())
    monkeypatch.setattr(uvicorn, "run", lambda app, host, port: captured.update(app=app))

    code = cli._serve_command([])

    assert code == 0
    assert "/playground" not in [route.path for route in captured["app"].routes]
