"""Retry loop tests using a fake structured-output runnable, no network involved."""

import pytest
from helpers import FakeStructuredLLM, _ok, _request
from langchain_core.messages import AIMessage, HumanMessage

from oakestra_sla_gen.generator import (
    NeedsClarification,
    SLAGenerationError,
    SLASession,
    _image_mentioned_by_user,
    generate_sla,
)
from oakestra_sla_gen.models import Clarification, SLARequest


def test_retries_after_validation_error_then_succeeds():
    # Duplicate microservice names are valid Pydantic-wise but rejected by validate_sla,
    # so this exercises the semantic-check layer of the retry loop, not the model layer.
    invalid = _request("nginx", "nginx")
    valid = _request("nginx")
    fake = FakeStructuredLLM(
        [
            _ok(invalid, "first"),
            _ok(valid, "second"),
        ]
    )

    sla = generate_sla("two nginx", structured_llm=fake, max_retries=3)

    assert len(sla["applications"][0]["microservices"]) == 1
    assert len(fake.calls) == 2
    second_call_text = " ".join(getattr(m, "content", "") for m in fake.calls[1])
    assert "used more than once" in second_call_text


def test_exhausting_retries_raises_with_last_candidate():
    invalid = _request("nginx", "nginx")
    fake = FakeStructuredLLM([_ok(invalid)] * 2)

    with pytest.raises(SLAGenerationError) as exc_info:
        generate_sla("two nginx", structured_llm=fake, max_retries=2)

    assert exc_info.value.errors
    assert exc_info.value.last_candidate is not None


def test_parsing_error_retries_and_raises_with_no_candidate():
    fake = FakeStructuredLLM(
        [{"raw": AIMessage(content="garbage"), "parsed": None, "parsing_error": "boom"}] * 2
    )

    with pytest.raises(SLAGenerationError) as exc_info:
        generate_sla("bad", structured_llm=fake, max_retries=2)

    assert len(fake.calls) == 2
    assert exc_info.value.last_candidate is None


def test_on_attempt_callback_receives_each_attempt():
    valid = _request("nginx")
    fake = FakeStructuredLLM([_ok(valid)])
    seen = []

    generate_sla(
        "nginx", structured_llm=fake, max_retries=1, on_attempt=lambda a, e: seen.append((a, e))
    )

    assert seen == [(1, [])]


def test_transport_errors_propagate_without_retrying():
    class Unreachable(FakeStructuredLLM):
        def invoke(self, messages):
            self.calls.append(list(messages))
            raise ConnectionError("server down")

    fake = Unreachable([])
    with pytest.raises(ConnectionError):
        generate_sla("nginx", structured_llm=fake, max_retries=3)
    assert len(fake.calls) == 1


def test_prompt_method_parses_fenced_json_and_reports_garbage():
    from langchain_core.language_models.fake_chat_models import FakeListChatModel
    from langchain_core.messages import HumanMessage, SystemMessage

    from oakestra_sla_gen.generator import build_structured_llm

    fenced = "```json\n" + _request("nginx").model_dump_json() + "\n```"
    fake = FakeListChatModel(responses=[fenced, "not json"])
    chain = build_structured_llm(fake, method="prompt")
    messages = [SystemMessage("sys"), HumanMessage("nginx")]

    ok = chain.invoke(messages)
    assert ok["parsing_error"] is None
    assert ok["parsed"].applications[0].microservices[0].microservice_name == "nginx"

    bad = chain.invoke(messages)
    assert bad["parsed"] is None
    assert bad["parsing_error"] is not None


def _questions_only(*questions) -> SLARequest:
    return SLARequest(applications=[], questions=list(questions))


def test_start_returns_questions_only_draft_when_nothing_can_be_drafted():
    request = _questions_only(
        Clarification(topic="application", question="what should be deployed?")
    )
    fake = FakeStructuredLLM([_ok(request)])

    draft = SLASession(structured_llm=fake).start("deploy my app")

    assert draft.sla is None
    assert [q.question for q in draft.questions] == ["what should be deployed?"]


def test_start_returns_sla_with_questions_when_something_is_uncertain():
    request = _request("nginx")
    request.questions = [
        Clarification(topic="nginx memory", question="how much memory?", assumption="128MB")
    ]
    fake = FakeStructuredLLM([_ok(request)])

    draft = SLASession(structured_llm=fake).start("an nginx server")

    assert draft.sla is not None
    assert draft.questions[0].topic == "nginx memory"


def test_generate_sla_raises_needs_clarification_when_no_sla():
    request = _questions_only(Clarification(topic="application", question="what?"))
    fake = FakeStructuredLLM([_ok(request)])

    with pytest.raises(NeedsClarification) as exc_info:
        generate_sla("deploy my app", structured_llm=fake)

    assert exc_info.value.questions[0].question == "what?"


def test_answer_refines_draft_and_drops_failed_attempts_from_history():
    invalid = _request("nginx", "nginx")
    valid1 = _request("nginx")
    valid2 = _request("redis")
    fake = FakeStructuredLLM(
        [
            _ok(invalid, "bad-attempt"),
            _ok(valid1, "good-first"),
            _ok(valid2, "good-second"),
        ]
    )
    session = SLASession(structured_llm=fake, max_retries=3)

    first = session.start("two nginx, keep one")
    assert first.sla["applications"][0]["microservices"][0]["microservice_name"] == "nginx"

    second = session.answer("use redis instead")
    assert second.sla["applications"][0]["microservices"][0]["microservice_name"] == "redis"

    contents = [getattr(m, "content", "") for m in session.messages]
    assert "bad-attempt" not in contents
    # system, human+ai for turn 1, human+ai for turn 2 - no leftover correction messages
    assert len(session.messages) == 5


def test_guessed_missing_image_triggers_retry(monkeypatch):
    from oakestra_sla_gen import generator

    monkeypatch.setattr(generator, "image_exists", lambda ref, timeout=5.0: "madeup" not in ref)
    bad = SLARequest(
        applications=[
            {
                "application_name": "web",
                "application_namespace": "default",
                "microservices": [
                    {
                        "microservice_name": "app",
                        "microservice_namespace": "default",
                        "code": "docker.io/library/madeup:latest",
                    }
                ],
            }
        ]
    )
    good = _request("nginx")
    fake = FakeStructuredLLM(
        [
            _ok(bad),
            _ok(good, "y"),
        ]
    )

    sla = generate_sla("nginx please", structured_llm=fake, max_retries=2)

    assert sla["applications"][0]["microservices"][0]["microservice_name"] == "nginx"
    assert len(fake.calls) == 2
    correction_text = " ".join(getattr(m, "content", "") for m in fake.calls[1])
    assert "does not exist in its registry" in correction_text


def test_user_given_missing_image_becomes_question_not_retry(monkeypatch):
    from oakestra_sla_gen import generator

    monkeypatch.setattr(generator, "image_exists", lambda ref, timeout=5.0: False)
    request = SLARequest(
        applications=[
            {
                "application_name": "web",
                "application_namespace": "default",
                "microservices": [
                    {
                        "microservice_name": "app",
                        "microservice_namespace": "default",
                        "code": "ghcr.io/me/privateapp:1.0",
                    }
                ],
            }
        ]
    )
    fake = FakeStructuredLLM([_ok(request)])

    draft = SLASession(structured_llm=fake, max_retries=1).start(
        "deploy ghcr.io/me/privateapp:1.0 on my own cluster"
    )

    assert draft.sla is not None
    assert len(fake.calls) == 1
    assert any("privateapp" in q.question for q in draft.questions)


def test_none_from_image_exists_is_ignored(monkeypatch):
    from oakestra_sla_gen import generator

    monkeypatch.setattr(generator, "image_exists", lambda ref, timeout=5.0: None)
    request = _request("nginx")
    fake = FakeStructuredLLM([_ok(request)])

    draft = SLASession(structured_llm=fake).start("nginx")

    assert draft.sla is not None
    assert draft.questions == []


def test_plausibility_question_for_excessive_memory():
    request = SLARequest(
        applications=[
            {
                "application_name": "web",
                "application_namespace": "default",
                "microservices": [
                    {
                        "microservice_name": "cache",
                        "microservice_namespace": "default",
                        "code": "docker.io/library/redis:latest",
                        "memory": 10 * 1024 * 1024,  # "10TB of memory"
                    }
                ],
            }
        ]
    )
    fake = FakeStructuredLLM([_ok(request)])

    draft = SLASession(structured_llm=fake).start("a redis cache with 10TB of memory")

    assert draft.sla is not None
    assert any("memory" in q.topic for q in draft.questions)


def test_image_mentioned_by_user_matches_loosely():
    messages = [HumanMessage("run nginx:1.25 please")]
    assert _image_mentioned_by_user("docker.io/library/nginx:1.25", messages)
    assert not _image_mentioned_by_user("docker.io/library/redis:latest", messages)


def _single(name, code, **extra):
    return SLARequest(
        applications=[
            {
                "application_name": "web",
                "application_namespace": "default",
                "microservices": [
                    {
                        "microservice_name": name,
                        "microservice_namespace": "default",
                        "code": code,
                        **extra,
                    }
                ],
            }
        ]
    )


def test_repeated_missing_image_is_not_mistaken_for_user_given(monkeypatch):
    # The correction message quotes the missing image. If that counted as the user typing
    # it, the model repeating its mistake would turn into a question instead of an error.
    from oakestra_sla_gen import generator

    monkeypatch.setattr(generator, "image_exists", lambda ref, timeout=5.0: "madeup" not in ref)
    bad = _single("app", "docker.io/library/madeup:latest")
    fake = FakeStructuredLLM([_ok(bad)] * 2)

    with pytest.raises(SLAGenerationError):
        generate_sla("some app", structured_llm=fake, max_retries=2)


def test_answer_restates_all_questions_the_user_saw():
    # The memory question is added by the tool, not the model, so the model only knows
    # what "1" refers to if the answer restates the list.
    huge = _single("cache", "docker.io/library/redis:latest", memory=10 * 1024 * 1024)
    fixed = _single("cache", "docker.io/library/redis:latest", memory=10240)
    fake = FakeStructuredLLM(
        [
            _ok(huge),
            _ok(fixed, "y"),
        ]
    )
    session = SLASession(structured_llm=fake)
    session.start("a redis cache with 10TB of memory")

    draft = session.answer("1. no, 10GB")

    last_human = [m for m in fake.calls[1] if isinstance(m, HumanMessage)][-1].content
    assert "1. [cache memory]" in last_human
    assert "My answer: 1. no, 10GB" in last_human
    assert draft.questions == []
