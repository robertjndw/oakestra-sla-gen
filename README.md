# oakestra-sla-gen

Generate a verified [Oakestra](https://oakestra.io) SLA from a free-text description.

Oakestra deploys applications from a JSON SLA document. Writing one by hand is easy to get
wrong: strict name rules, exact field names, port syntax, units. This tool asks an
OpenAI-compatible LLM for the SLA (through LangChain structured output) and **verifies it
before printing it**. The only thing this tool ever prints is an SLA that passed
verification - if it can't produce one, it fails loudly instead.

Generation is interactive by default: the model drafts what it can, lists the parts it's
unsure about as questions (each with the assumption it used, if any), and you answer in free
text until you accept the draft. If a description is too vague to draft anything ("deploy my
app"), it asks instead of inventing an app.

## Install

```
uv sync
```

## Usage

```
uv run oakestra-sla-gen "a single nginx web server on port 80 with 1 cpu and 512MB memory"
uv run oakestra-sla-gen "nginx on port 8080 with 1 cpu and 256MB" -o sla.json
uv run oakestra-sla-gen -f description.txt
echo "..." | uv run oakestra-sla-gen
uv run oakestra-sla-gen --compose compose.yaml "pin api to cluster edge1"
uv run oakestra-sla-gen validate existing_sla.json
```

### Interactive mode

When stdin and stderr are both a terminal, generation is a back-and-forth: each round prints
a summary of the current draft and any open questions (with the assumption each one made) to
stderr, then prompts for your answer. Empty input accepts the current draft, `q` aborts.

```
$ uv run oakestra-sla-gen "deploy my app"
1. [application] What should be deployed? Please describe the software or image, and how
   it should be reached (ports, protocols).
2. [dependencies] Does the app depend on any other services (databases, caches, ...)?
3. [resources] What resources does the app need (CPU, memory, storage, GPU)?
answer (Enter to accept, q to quit)> it's my flask api image ghcr.io/acme/orders:2.1 on
port 8000, needs a postgres database with password ordersecret
  api - ghcr.io/acme/orders:2.1 - port 8000:8000 - 1 vcpu / 512MB
  pg - docker.io/library/postgres:latest - 1 vcpu / 1024MB - rr_ip 10.30.0.1
1. [api env vars] What environment variable names does your image expect for the database
   connection? (assuming: DB_HOST and DB_PASSWORD)
2. [postgres database name] Does the app expect a specific database name? (assuming: default
   'postgres' database)
answer (Enter to accept, q to quit)>
{
  "sla_version": "v2.0",
  ...
}
```

The final SLA goes to stdout (or `-o`) exactly as in non-interactive mode; the rest of the
exchange, including the leftover questions accepted alongside it, is on stderr.

Pass `--no-interactive` (or pipe stdin/redirect stderr, which implies it) to disable the
prompt: the SLA is printed if there is one, with any remaining questions and their
assumptions on stderr as "Assumptions made:". If the description was too vague to draft
anything, only the questions are printed and the command exits `3`.

Flags for generation:

| Flag | Env var | Default |
|---|---|---|
| `--base-url` | `OPENAI_BASE_URL` | `http://127.0.0.1:1234/v1` |
| `--model` | `OAKESTRA_SLA_MODEL` | `qwen/qwen3.8-27b` |
| `--api-key` | `OPENAI_API_KEY` | `lm-studio` |
| `--method` | - | `prompt` (or `json_schema`, `function_calling`) |
| `--max-retries` | - | `3` |
| `--customer-id` | - | `Admin` |
| `--reasoning-effort` | - | `low` (`medium`, `high`) |
| `--no-image-check` | - | off - skip verifying that images exist in their registry |
| `--no-interactive` | - | off - never prompt, see above |
| `-v` / `--verbose` | - | log each attempt and its errors to stderr |
| `-c` / `--compose` | - | translate a docker compose file instead of free text, see below |

With `-c`/`--compose FILE`, the positional text, `-f`, and stdin become optional notes
alongside the compose file (e.g. `--compose compose.yaml "pin web to edge1"`) rather than the
whole description. A compose file that fails to parse, or doesn't exist, exits `2`. See
"Docker Compose input" below for what's translated.

Exit codes: `0` a verified SLA was printed, `1` generation failed or was aborted (`q`) within
the retry budget (errors on stderr), `2` usage or connection error, `3` (non-interactive
only) the description needs clarification and no SLA was produced.

`oakestra-sla-gen validate <file>` runs the same verifier a generated SLA goes through
against a hand-written SLA file, and prints `valid` or the list of problems.

## HTTP server

The server is an optional extra, so the plain CLI install doesn't pull in FastAPI:

```
uv sync --extra server                 # or: pip install "oakestra-sla-gen[server]"
uv run oakestra-sla-gen serve          # http://127.0.0.1:8000, docs at /docs
uv run oakestra-sla-gen serve --host 0.0.0.0 --port 9000 --model openai/gpt-oss-20b
```

`serve` takes the same `--base-url` / `--model` / `--api-key` / `--reasoning-effort` flags
(and env vars) as generation. They're fixed when the server starts. Everything else is set
per request:

- `POST /generate` with `{"description": "...", "compose": "...", "method": "prompt",
  "customer_id": "Admin", "max_retries": 3}`. Either `description` or `compose` is required
  (both together are fine - `compose` becomes the translation, `description` becomes notes
  alongside it). Returns the verified SLA with `200`, `422` with `{"detail", "errors",
  "last_candidate"}` if no valid SLA came out within `max_retries` (capped at 10), `422` with
  `{"detail", "questions"}` if the input was too vague to draft anything at all, `422` with a
  readable `msg` if `compose` isn't a usable compose file, or `502` if the LLM server failed.
  The server is a single-shot endpoint - it doesn't expose the interactive session, so a vague
  description or one with a lot of open questions just comes back as questions once, with no
  follow-up turn.
- `POST /validate` with an SLA document as the body. Always returns `200` with
  `{"valid": bool, "errors": [...]}`.

```
curl -X POST localhost:8000/generate -H 'content-type: application/json' \
  -d '{"description": "a single nginx web server on port 80 with 1 cpu and 512MB memory"}'
```

### Playground

`serve --playground` also mounts a browser UI at `/playground`: a split-screen view of the
interactive draft/answer loop that the CLI's interactive mode and `SLASession` already do,
without reading JSON on a terminal.

```
uv run oakestra-sla-gen serve --playground
```

You can also upload a docker compose file instead of typing a description - the composer has
an upload button (and accepts a drag-and-drop) for it, with an optional note field alongside.

The left pane is the conversation. Each round says whether the draft passed validation (and
on which attempt), what changed since the previous draft, and lists the model's open
questions. You can keep each assumption or answer it right there, then update the draft or
accept it. The right pane shows the current SLA in one of two views:

- **Visual** shows a map of the services, what's reachable from outside, and which service
  references another's service IP. Below it is a section per service, with changed fields and
  validation problems marked.
- **Code** is the SLA JSON. You can edit it, it's re-checked against `POST /validate` as you
  type, and clicking a problem jumps to its line.

The header shows the model the server was started with.

This adds a few endpoints behind `/playground`, all backed by an in-memory session store:

- `POST /playground/sessions` starts a session from a description and/or compose file (same
  fields as `POST /generate`, plus `check_images`) and returns
  `{session_id, sla, questions, attempts}`.
- `POST /playground/sessions/{id}/answer` continues a session with `{text}` and returns the
  same shape.
- `DELETE /playground/sessions/{id}` drops a session.
- `GET /playground/info` returns `{model}`, the model name the page shows.

Sessions live only in this process's memory - they don't survive a restart and aren't shared
across worker processes - and are capped in count and by idle time, oldest evicted first.

## Docker Compose input

The CLI's `--compose`, `/generate`'s `compose` field, and the playground's upload button all
take a docker compose file and translate it with the LLM into an Oakestra application, one
microservice per service - the same validate/retry loop and image/plausibility questions run
on the result as for a text description. `--compose`/`compose` isn't docker-compose-specific
parsing: the compose text (and any notes) are sent to the model with a set of translation
rules, so the same review-and-answer flow applies if it gets something wrong.

What's translated: `image` becomes a fully qualified `code`; `ports` (short or long syntax,
ranges where practical); `environment` (list or map, `${VAR:-default}` resolved);
`command`; and resources from `deploy.resources`/`cpus`/`mem_limit`, falling back to the
usual realistic minimums when none are given. **Compose service names don't resolve in
Oakestra**: any service another one refers to (by hostname, a connection URL, `depends_on`,
or `links`) gets a service IP (`addresses.rr_ip`), and every reference to it is rewritten to
that IP.

What's dropped, with a question raised when it matters: `volumes`, `networks`,
`healthcheck`, `restart`, `secrets`, `configs`, and `entrypoint` (no Oakestra equivalent).
Uploads are capped at 64,000 characters.

## Docker

`compose.yaml` builds the image and starts the HTTP server with the playground enabled:

```
docker compose up --build              # http://localhost:8000/playground
PORT=9000 docker compose up --build    # if 8000 is taken on the host
```

The LLM isn't part of the container. By default it talks to LM Studio on the Docker host at
`http://host.docker.internal:1234/v1`. Set `OPENAI_BASE_URL`, `OPENAI_API_KEY` and
`OAKESTRA_SLA_MODEL` in the environment (or a `.env` file) to point it somewhere else. On Linux,
LM Studio has to listen on all interfaces rather than only `127.0.0.1`, or the container can't
reach it. Docker Desktop on macOS and Windows forwards to the host's loopback, so it works as is.

## Oakestra addon

The server can run as an [Oakestra addon](https://github.com/oakestra/oakestra/tree/develop/addons_engine):
the root orchestrator's addons engine then runs the container next to the control plane,
on the `oakestra` Docker network. `oakestra-addon.json` is the marketplace entry for it.

The image is published to `ghcr.io/robertjndw/oakestra-sla-gen` (amd64 and arm64) by
`.github/workflows/image.yml`: `latest` from `main`, plus a version tag for each `v*` git tag.
The marketplace pulls the image to approve an addon, so the package has to be public (or the
root orchestrator host has to be logged in to GHCR).

Before registering, check `environment` in `oakestra-addon.json`. The addons engine starts the
container with plain `docker run` options and can't add `extra_hosts`, so
`host.docker.internal` doesn't resolve there. The default, `172.17.0.1`, is the Docker bridge
gateway on a Linux host, which reaches an LLM server on the root orchestrator host as long as
it listens on all interfaces. For an LLM elsewhere, use its real address. Marketplace entries
are stored and shown in plain text, so don't put a real API key in there on a shared setup.

Then register and install it (ports as in a default root orchestrator):

```
# register with the marketplace, it moves from under_review to approved once the image pulled
curl -X POST http://<root-orchestrator>:11102/api/v1/marketplace/addons \
  -H 'content-type: application/json' -d @oakestra-addon.json

# install it, using the _id from the response above
curl -X POST http://<root-orchestrator>:11101/api/v1/addons \
  -H 'content-type: application/json' -d '{"marketplace_id": "<_id>"}'
```

The same works from the addons dashboard on port 11103. The addons monitor polls every 30
seconds by default, after which the playground is at
`http://<root-orchestrator>:8000/playground`. In `ports`, the key is the container port and the
value is the host port (the Docker SDK's convention, the dashboard's form labels them the other
way round), so change the value to move it off 8000.

## How it works

1. A Pydantic model (`models.py`) constrains what the LLM can produce. It only covers a
   practical subset of Oakestra's SLA: the fields Oakestra's schedulers
   (`scheduler/calculate/schedulers/*/calculate.go`) actually read - `vcpus`, `memory`,
   `virtualization`, and `direct` (node/cluster) constraints. Latency and geo constraints are
   parsed by Oakestra but never used for scheduling, so the LLM isn't asked to invent them.
2. `generator.build_structured_llm` turns the model into a structured-output runnable. The
   default `prompt` method puts the JSON schema into the system prompt with LangChain's
   `PydanticOutputParser`. See "Structured output methods" below for why this is the
   default instead of server-side constrained decoding.
3. The model's output is wrapped into a full Oakestra SLA document and checked against
   Oakestra's own JSON Schema (vendored in `oakestra_schema.py`), plus semantic checks the
   schema doesn't cover (port syntax and range, `KEY=value` environment entries, unique
   microservice names, non-negative resources, and so on) - see `validation.py`.
4. If either layer rejects the output, the errors are fed back to the LLM as a correction
   message and it retries, up to `--max-retries` times. Only a verified SLA is ever printed.
5. Once an attempt validates, each microservice's `code` is checked against its registry
   (`registry.py`, skipped with `--no-image-check`). If the model picked an image itself and
   it doesn't exist, that's fed back as a validation error and retried like any other; if the
   user actually typed that image, it's left alone but turned into a question, since it might
   just be private. A handful of resource values (very large memory/vcpus/vgpus/storage) get
   the same treatment: not an error, but a question asking whether that's really intended.
6. `SLASession` (`generator.py`) wraps this into a conversation: each `start`/`answer` call
   runs the loop above for one turn and returns a `Draft` (the SLA so far, or `None`, plus the
   open questions). The CLI's interactive mode is a thin loop around it - see above.

## Docs vs. code discrepancies

The [SLA docs](https://oakestra.io/docs/reference/app-sla) and the real validator
(`root_orchestrator/system-manager-python/sla/schema.py`, checked via `jsonschema.validate`
in `sla/v2_validator.py`) disagree in a few places:

- The schema uses **`vcpus` / `vgpus`** (plural, integers). The docs say `vcpu`/`vgpu`.
- `application_name`, `application_namespace`, `microservice_name`, and
  `microservice_namespace` must match `^[a-zA-Z0-9]{1,32}$` in the schema, but the docs say
  max 10 characters. This tool applies the stricter rule (1-10 alphanumeric characters) so
  its output satisfies both. `validation.py` checks this on top of the vendored schema, not
  instead of it - `tests/test_validation.py` asserts Oakestra's own correct fixtures pass the
  vendored schema on its own, and separately documents which ones exceed our stricter rule.
- `microserviceID` must be an empty string (`maxLength: 0`) in the schema. This tool always
  emits `""` for it and lets Oakestra assign a real one.

## Structured output methods

`--method` picks how the Pydantic schema reaches the model:

- **`prompt`** (default): the schema goes into the system prompt via `PydanticOutputParser`,
  and the model answers freely. Parsing and verification catch anything malformed, and the
  retry loop feeds the errors back.
- **`json_schema`**: server-side grammar-constrained decoding (`response_format`). It's built
  by hand with `strict: False`, because `with_structured_output` always sends a strict schema
  for a Pydantic class, and LM Studio's decoder ran away on retry turns with that shape.
- **`function_calling`**: `with_structured_output(method="function_calling")`. LM Studio
  rejects it with a 400, because LangChain sends `tool_choice` as an object and LM Studio
  only accepts `none`/`auto`/`required`.

`prompt` is the default because, on the LM Studio build used for development, constrained
decoding silently lost content. With every local model tried (gpt-oss-20b,
gemma-4-26b, qwen3.8-27b), `json_schema` returned only the first microservice of
multi-service descriptions and dropped environment variables. It also produced garbled values
like `ghcr.io/me/api:1..2` or `"port": "5000-500?"`. The result often still passed
verification, which makes this worse than an outright error. The same models with `prompt`
got every test description right: all microservices, env vars, and constraints.
If your endpoint's constrained decoding is trustworthy (e.g. OpenAI itself), `json_schema`
is a fine choice.

## Choosing a default model

The default is `qwen/qwen3.8-27b` at `--reasoning-effort low`. Over 18 evaluation
descriptions it produced a valid SLA every time (18/18) and found real images for 6 of 8
held-out cases that require knowing an actual image name, versus 4/8 for `gpt-oss-20b` - at
about 76s per SLA versus about 10s for gpt-oss-20b. At the default (unset) reasoning effort,
qwen sometimes spent its whole token budget reasoning and ran for up to 13 minutes, which is
why `low` is the default rather than leaving it unset.

`openai/gpt-oss-20b` remains available via `--model openai/gpt-oss-20b` as the fast option
when speed matters more than getting an unusual image name right. It is a reasoning model
too, but its reasoning stays short, so the effort setting matters much less for it.

## Development

```
uv run ruff check
uv run ruff format
uv run pytest              # fast tests, no network
uv run pytest -m llm       # integration tests against LM Studio, skipped if unreachable
```

`tests/fixtures/` holds Oakestra's own `sla_correct_*.json` / `sla_flawed_*.json` fixtures,
vendored from `root_orchestrator/system-manager-python/tests/service_level_agreements/`.
`sla_flawed_1` and `sla_flawed_3` both lack `sla_version`; in Oakestra's own code that raises
a `KeyError` because its parser (`sla/versioned_sla_parser.py`) reads `sla["sla_version"]`
directly before ever validating against the schema. This tool calls `jsonschema` directly
instead of going through that parser, so a missing `sla_version` shows up as a normal
validation error in the returned list rather than an exception - see the comment at the top
of `tests/test_validation.py` for the full breakdown, fixture by fixture.
