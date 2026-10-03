"""Generate a verified Oakestra SLA from a free-text description via an LLM."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from operator import itemgetter
from typing import Literal, get_args

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import RunnableLambda, RunnableMap, RunnablePassthrough
from langchain_openai import ChatOpenAI

from .models import Clarification, SLARequest
from .prompts import CORRECTION_TEMPLATE, SYSTEM_PROMPT
from .registry import image_exists
from .validation import iter_microservices, validate_sla

# From our evaluation over 18 descriptions: qwen3.8 at low reasoning effort got 18/18 valid
# SLAs, found real images for 6/8 held-out cases (vs. 4/8 for gpt-oss-20b) and took about
# 76s per SLA. At the default effort it sometimes burned its whole token budget reasoning
# and ran up to 13 minutes. gpt-oss-20b stays available via --model as the fast option
# (~10s/SLA, less accurate on image names). See README.
DEFAULT_MODEL = "qwen/qwen3.8-27b"
DEFAULT_REASONING_EFFORT = "low"

OutputMethod = Literal["prompt", "json_schema", "function_calling"]
OUTPUT_METHODS: tuple[str, ...] = get_args(OutputMethod)
# Which method works depends on the LLM server, not on the request, so this is set per
# deployment next to the model. See build_structured_llm for why `prompt` is the default.
DEFAULT_METHOD: OutputMethod = "prompt"

# Plausibility thresholds for the resource questions below. These are generous on purpose -
# they're meant to catch "10TB of memory" typos and misreadings, not to second-guess anyone
# who actually wants a big machine.
MAX_MEMORY_MB = 262144  # 256 GB
MAX_VCPUS = 64
MAX_VGPUS = 8
MAX_STORAGE_MB = 10 * 1024 * 1024  # 10 TB

_PLAUSIBILITY_LIMITS = [
    ("memory", MAX_MEMORY_MB),
    ("vcpus", MAX_VCPUS),
    ("vgpus", MAX_VGPUS),
    ("storage", MAX_STORAGE_MB),
]

_DOCKER_HUB_PREFIXES = (
    "index.docker.io/library/",
    "index.docker.io/",
    "docker.io/library/",
    "docker.io/",
)


class SLAGenerationError(Exception):
    """Raised when no valid SLA could be produced within the retry budget."""

    def __init__(self, errors: list[str], last_candidate: dict | None):
        self.errors = errors
        self.last_candidate = last_candidate
        super().__init__("could not produce a valid SLA: " + "; ".join(errors))


class NeedsClarification(Exception):
    """Raised by `generate_sla` when the draft has no SLA yet, only questions."""

    def __init__(self, questions: list[Clarification]):
        self.questions = questions
        super().__init__(
            "the description needs clarification before an SLA can be produced: "
            + "; ".join(q.question for q in questions)
        )


@dataclass
class Draft:
    """One round of an `SLASession`: a verified SLA (or none yet) plus open questions."""

    sla: dict | None
    questions: list[Clarification] = field(default_factory=list)


def build_llm(
    base_url: str = "http://127.0.0.1:1234/v1",
    model: str = DEFAULT_MODEL,
    api_key: str = "lm-studio",
    temperature: float = 0,
    max_tokens: int = 8192,
    reasoning_effort: str | None = DEFAULT_REASONING_EFFORT,
) -> ChatOpenAI:
    """`api_key` defaults to a placeholder: local servers ignore it, but the client requires one.

    `max_tokens` is generous because reasoning models (gpt-oss, qwen3) spend a
    good part of the budget thinking before they write the JSON.
    """
    return ChatOpenAI(
        base_url=base_url,
        model=model,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
        reasoning_effort=reasoning_effort,
    )


def _with_parse_result(chain, parse):
    """Shape `chain`'s output like `with_structured_output(..., include_raw=True)` does."""
    with_parsed = RunnablePassthrough.assign(
        parsed=itemgetter("raw") | RunnableLambda(parse), parsing_error=lambda _: None
    )
    without_parsed = RunnablePassthrough.assign(parsed=lambda _: None)
    with_fallback = with_parsed.with_fallbacks([without_parsed], exception_key="parsing_error")
    return RunnableMap(raw=chain) | with_fallback


def build_structured_llm(llm: ChatOpenAI, method: str = DEFAULT_METHOD):
    """Build a runnable that returns `{"raw", "parsed", "parsing_error"}` for `SLARequest`.

    `prompt` (the default) puts the JSON schema into the system prompt via
    `PydanticOutputParser` and lets the model answer freely. That sounds weaker
    than server-side constrained decoding, but LM Studio's grammar-constrained
    `json_schema` mode reliably truncated output with every local model we
    tried: second microservices and env vars silently disappeared, and values
    got garbled ("1..2", "5000-500?"). The result still validated, which makes
    that failure mode worse than an outright error. Free output + Pydantic
    parsing + the validate/retry loop was correct on every test prompt.

    `json_schema` sends `strict: False` by hand instead of going through
    `with_structured_output`, because LangChain always requests a strict schema
    for a Pydantic class, and LM Studio's decoder ran away on that shape on
    retry turns. Use it with servers whose constrained decoding is trustworthy.
    """
    if method == "prompt":
        parser = PydanticOutputParser(pydantic_object=SLARequest)
        instructions = parser.get_format_instructions()

        def add_format_instructions(messages):
            system, *rest = messages
            return [SystemMessage(f"{system.content}\n\n{instructions}"), *rest]

        return _with_parse_result(RunnableLambda(add_format_instructions) | llm, parser.invoke)

    if method == "json_schema":
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "SLARequest",
                "schema": SLARequest.model_json_schema(),
                "strict": False,
            },
        }
        return _with_parse_result(
            llm.bind(response_format=response_format),
            lambda message: SLARequest.model_validate_json(message.content),
        )

    return llm.with_structured_output(SLARequest, method=method, include_raw=True)


def format_question(question: Clarification) -> str:
    text = f"[{question.topic}] {question.question}"
    if question.assumption:
        text += f" (assuming: {question.assumption})"
    return text


def _normalize_image(ref: str) -> str:
    for prefix in _DOCKER_HUB_PREFIXES:
        if ref.startswith(prefix):
            return ref[len(prefix) :]
    return ref


def _image_mentioned_by_user(image: str, messages: list[BaseMessage]) -> bool:
    """Loose match so e.g. "nginx:1.25" typed by the user matches the model's
    "docker.io/library/nginx:1.25": compare both the raw and the Docker-Hub-stripped form
    against every human message as a substring."""
    normalized = _normalize_image(image)
    for message in messages:
        if not isinstance(message, HumanMessage) or not isinstance(message.content, str):
            continue
        if image in message.content or normalized in message.content:
            return True
    return False


def _check_images(sla: dict, messages: list[BaseMessage]) -> tuple[list[str], list[Clarification]]:
    """Look up every microservice's image. A missing image the model picked itself is a
    validation error (retry with a better one); a missing image the user typed is left as-is
    but flagged as a question, since it might just be private."""
    microservices = list(iter_microservices(sla))
    codes = {microservice.get("code", "") for microservice in microservices}
    # An uncached Docker Hub lookup is three round trips, so look the images up concurrently
    # instead of paying for that once per service.
    with ThreadPoolExecutor() as pool:
        exists = dict(zip(codes, pool.map(image_exists, codes), strict=True))

    errors: list[str] = []
    questions: list[Clarification] = []
    for microservice in microservices:
        code = microservice.get("code", "")
        if exists[code] is not False:
            continue
        if _image_mentioned_by_user(code, messages):
            questions.append(
                Clarification(
                    topic=f"{microservice.get('microservice_name')} image",
                    question=(
                        f"could not find image {code} in its registry - "
                        "is the name right, or is it private?"
                    ),
                    assumption=f"keep {code} as given",
                )
            )
        else:
            errors.append(
                f"image {code} does not exist in its registry; "
                "use the correct image name or ask the user"
            )
    return errors, questions


def _plausibility_questions(sla: dict) -> list[Clarification]:
    questions = []
    for microservice in iter_microservices(sla):
        name = microservice.get("microservice_name")
        for resource, limit in _PLAUSIBILITY_LIMITS:
            value = microservice.get(resource)
            if isinstance(value, int | float) and value > limit:
                questions.append(
                    Clarification(
                        topic=f"{name} {resource}",
                        question=(
                            f"{value} for {resource} on {name} is unusually high - "
                            "is that really what you want?"
                        ),
                        assumption=f"keeps {value} as requested",
                    )
                )
    return questions


class SLASession:
    """Build an SLA together with the user: `start` a draft, then `answer` its questions
    until they accept it. Keeps the conversation as LangChain messages, but only the
    winning attempt of each turn - failed candidates and correction messages are dropped
    once a turn succeeds, so the context doesn't grow with garbage across turns."""

    def __init__(
        self,
        llm: ChatOpenAI | None = None,
        structured_llm=None,
        method: str = DEFAULT_METHOD,
        customer_id: str = "Admin",
        max_retries: int = 3,
        check_images: bool = True,
        on_attempt=None,
    ):
        if structured_llm is None:
            structured_llm = build_structured_llm(llm or build_llm(), method=method)
        self.structured_llm = structured_llm
        self.customer_id = customer_id
        self.max_retries = max_retries
        self.check_images = check_images
        self.on_attempt = on_attempt
        self.messages: list[BaseMessage] = [SystemMessage(SYSTEM_PROMPT)]
        self.draft: Draft | None = None

    def start(self, description: str) -> Draft:
        return self._turn(description)

    def answer(self, text: str) -> Draft:
        # The user answers the numbered list they were shown, which includes questions the
        # tool added itself (missing images, implausible resources). The model never saw
        # those, so restate the list or "2. yes" is meaningless to it.
        if self.draft and self.draft.questions:
            numbered = "\n".join(
                f"{i}. {format_question(q)}" for i, q in enumerate(self.draft.questions, 1)
            )
            text = f"Open questions I was shown:\n{numbered}\n\nMy answer: {text}"
        return self._turn(text)

    def _turn(self, text: str) -> Draft:
        base = [*self.messages, HumanMessage(text)]
        draft, ai_message = self._run_retry_loop(base)
        self.messages = [*base, ai_message] if ai_message is not None else base
        self.draft = draft
        return draft

    def _run_retry_loop(self, messages: list[BaseMessage]) -> tuple[Draft, AIMessage | None]:
        """Run the validate/retry loop for one turn of `messages` (system + history + the latest
        human message). Returns the resulting draft and the raw AI message that produced it, so the
        caller can decide what belongs in the persistent conversation."""
        turn_messages = list(messages)
        errors: list[str] = []
        last_candidate: dict | None = None
        last_questions: list[Clarification] = []

        for attempt in range(1, self.max_retries + 1):
            # Transport errors (server down, bad URL, auth) are deliberately not
            # caught: retrying won't fix them and they shouldn't be reported as a
            # bad SLA. Bad model output comes back as parsing_error instead.
            result = self.structured_llm.invoke(turn_messages)
            raw = result.get("raw")
            parsed = result.get("parsed")
            parsing_error = result.get("parsing_error")

            if parsing_error is not None or parsed is None:
                errors = [f"the model's response could not be parsed: {parsing_error}"]
                last_candidate, last_questions = None, []
            elif not parsed.applications:
                # Too vague to draft anything - nothing to validate or check images for.
                errors = []
                last_candidate, last_questions = None, list(parsed.questions)
            else:
                candidate = parsed.to_oakestra_sla(self.customer_id)
                errors = validate_sla(candidate)
                questions = list(parsed.questions)
                if not errors and self.check_images:
                    # `messages`, not `turn_messages`: a correction message quoting a missing
                    # image must not make that image look user-provided on the next attempt.
                    image_errors, image_questions = _check_images(candidate, messages)
                    errors = image_errors
                    questions += image_questions
                if not errors:
                    questions += _plausibility_questions(candidate)
                last_candidate, last_questions = candidate, questions

            if self.on_attempt is not None:
                self.on_attempt(attempt, errors)

            if not errors:
                return Draft(sla=last_candidate, questions=last_questions), raw

            if isinstance(raw, AIMessage):
                turn_messages.append(raw)
            error_text = "\n".join(f"- {e}" for e in errors)
            turn_messages.append(HumanMessage(CORRECTION_TEMPLATE.format(errors=error_text)))

        raise SLAGenerationError(errors, last_candidate)


def generate_sla(
    description: str,
    *,
    structured_llm=None,
    llm: ChatOpenAI | None = None,
    method: str = DEFAULT_METHOD,
    customer_id: str = "Admin",
    max_retries: int = 3,
    check_images: bool = True,
    on_attempt=None,
) -> dict:
    """Thin non-interactive wrapper around a single-turn `SLASession`.

    `structured_llm` lets tests inject a fake runnable so no network call is made.
    `on_attempt(attempt, errors)` is an optional callback for CLI verbose logging.
    Raises `NeedsClarification` if the description was too vague to draft an SLA at all.
    """
    session = SLASession(
        llm=llm,
        structured_llm=structured_llm,
        method=method,
        customer_id=customer_id,
        max_retries=max_retries,
        check_images=check_images,
        on_attempt=on_attempt,
    )
    draft = session.start(description)
    if draft.sla is None:
        raise NeedsClarification(draft.questions)
    return draft.sla
