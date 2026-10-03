# oakestra-sla-gen

[![Build image](https://github.com/robertjndw/oakestra-sla-gen/actions/workflows/image.yml/badge.svg)](https://github.com/robertjndw/oakestra-sla-gen/actions/workflows/image.yml)
[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue)](pyproject.toml)
[![Container image](https://img.shields.io/badge/ghcr.io-oakestra--sla--gen-blue?logo=docker)](https://github.com/robertjndw/oakestra-sla-gen/pkgs/container/oakestra-sla-gen)

Generate a verified [Oakestra](https://oakestra.io) SLA from a free-text description or a
Docker Compose file, or modify an existing SLA.

Oakestra deploys applications from a JSON SLA document, and writing one by hand is easy to get
wrong: strict name rules, exact field names, port syntax, units. `oakestra-sla-gen` asks an
OpenAI-compatible LLM for the SLA and **verifies it against Oakestra's own schema before
printing it**. If it can't produce a valid SLA, it fails loudly instead of handing you a broken
one.

```sh
uv run oakestra-sla-gen "a single nginx web server on port 80 with 1 cpu and 512MB memory" -o sla.json
```

## Features

- **Verified output only** - every SLA is checked against Oakestra's JSON Schema plus semantic
  checks (ports, env vars, names, resources). Validation errors are fed back to the LLM, which
  retries until the SLA passes.
- **Interactive clarification** - the model drafts what it can and asks about what it's unsure
  of, showing the assumption it used. Vague descriptions get questions, not invented apps.
- **Docker Compose translation** - turn an existing `compose.yaml` into an Oakestra SLA.
- **Edit existing SLAs** - start from an SLA you already have and change it in plain language.
- **Image checks** - container images are looked up in their registry, so hallucinated image
  names are caught.
- **Any OpenAI-compatible LLM** - works with local models via LM Studio as well as hosted APIs.
- **CLI, HTTP API and browser playground** - use it from a terminal, a script, or a web UI.
- **Runs as an Oakestra addon** - deploy it next to your root orchestrator.

## Contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Docker Compose input](#docker-compose-input)
- [Existing SLA input](#existing-sla-input)
- [HTTP API](#http-api)
- [Playground](#playground)
- [Frontend](#frontend)
- [Deployment](#deployment)
- [How it works](#how-it-works)
- [Development](#development)

## Requirements

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- An OpenAI-compatible LLM endpoint. The defaults target a local
  [LM Studio](https://lmstudio.ai) server at `http://127.0.0.1:1234/v1` running
  `qwen/qwen3.8-27b`; see [Configuration](#configuration) to point it elsewhere.

## Quick start

```sh
git clone https://github.com/robertjndw/oakestra-sla-gen.git
cd oakestra-sla-gen
uv sync

# with LM Studio serving qwen/qwen3.8-27b on port 1234
uv run oakestra-sla-gen "a single nginx web server on port 80 with 1 cpu and 512MB memory"
```

Prefer a browser? Start the [playground](#playground) with Docker, no Python needed:

```sh
docker compose up --build    # API on :8000, playground on http://localhost:8080
```

## Usage

```sh
# description as an argument, from a file, or on stdin
uv run oakestra-sla-gen "nginx on port 8080 with 1 cpu and 256MB" -o sla.json
uv run oakestra-sla-gen -f description.txt
echo "..." | uv run oakestra-sla-gen

# translate a compose file, with optional notes
uv run oakestra-sla-gen --compose compose.yaml "pin api to cluster edge1"

# change an existing SLA
uv run oakestra-sla-gen --sla sla.json "give the api 2 cpus and add a redis cache"

# check a hand-written SLA with the same verifier
uv run oakestra-sla-gen validate existing_sla.json
```

The verified SLA goes to stdout (or the `-o` file). Everything else, such as questions,
assumptions and progress, goes to stderr, so the output is safe to pipe.

`validate` prints `valid` or the list of problems it found.

### Interactive mode

When stdin and stderr are both a terminal, generation is a back-and-forth. Each round prints
a summary of the current draft and any open questions (with the assumption each one made),
then prompts for your answer. Press Enter to accept the current draft, or type `q` to abort.

```console
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

### Non-interactive mode

Pass `--no-interactive` to disable the prompt. Piping stdin or redirecting stderr implies it.
The SLA is printed if there is one, and any remaining questions are listed on stderr under
"Assumptions made:". If the description was too vague to draft anything, only the questions
are printed and the command exits with `3`.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | A verified SLA was printed. |
| `1` | Generation failed within the retry budget, or was aborted with `q`. Errors are on stderr. |
| `2` | Usage or connection error, or a compose file or SLA that doesn't exist or doesn't parse. |
| `3` | Non-interactive only: the description needs clarification and no SLA was produced. |

## Configuration

| Flag | Env var | Default | Description |
|---|---|---|---|
| `--base-url` | `OPENAI_BASE_URL` | `http://127.0.0.1:1234/v1` | OpenAI-compatible API endpoint |
| `--model` | `OAKESTRA_SLA_MODEL` | `qwen/qwen3.8-27b` | Model name |
| `--api-key` | `OPENAI_API_KEY` | `lm-studio` | API key |
| `--reasoning-effort` | | `low` | `low`, `medium` or `high` |
| `--method` | `OAKESTRA_SLA_METHOD` | `prompt` | Structured output method: `prompt`, `json_schema` or `function_calling`. Pick what your LLM server supports |
| `--max-retries` | | `3` | Correction rounds before giving up |
| `--customer-id` | | `Admin` | Oakestra customer ID written into the SLA. With `--sla`, defaults to that file's own |
| `--no-image-check` | | off | Skip checking that images exist in their registry |
| `--no-interactive` | | off | Never prompt, see [Non-interactive mode](#non-interactive-mode) |
| `-c`, `--compose` | | | Translate a compose file, see [Docker Compose input](#docker-compose-input) |
| `-s`, `--sla` | | | Start from an existing SLA, see [Existing SLA input](#existing-sla-input) |
| `-f`, `--file` | | | Read the description from a file |
| `-o`, `--output` | | stdout | Write the SLA to a file |
| `-v`, `--verbose` | | off | Log each attempt and its errors to stderr |

Why `prompt` and `qwen/qwen3.8-27b` are the defaults is covered in the
[design notes](docs/design.md#structured-output-methods). For faster but less accurate
results, try `--model openai/gpt-oss-20b`.

Which method to use depends on the LLM server. `prompt` works everywhere and is the safe choice
for LM Studio and other local servers, whose constrained decoding can silently drop or garble
fields. `json_schema` suits servers with reliable constrained decoding, such as
OpenAI, and `function_calling` needs a model and server that support tool calling.

## Docker Compose input

The CLI's `--compose`, the HTTP API's `compose` field and the playground's upload button all
translate a Docker Compose file into an Oakestra application, one microservice per compose
service. With `--compose`, the positional text, `-f` and stdin become optional notes alongside
the file rather than the whole description.

| Compose | Oakestra |
|---|---|
| `image` | Fully qualified `code` |
| `ports` (short or long syntax, ranges where practical) | `port` |
| `environment` (list or map, `${VAR:-default}` resolved) | `environment` |
| `command` | `cmd` |
| `deploy.resources`, `cpus`, `mem_limit` | `vcpus`, `memory` (realistic minimums if unset) |
| Service references (hostnames, connection URLs, `depends_on`, `links`) | A service IP (`addresses.rr_ip`), with every reference rewritten to it |

Compose service names don't resolve in Oakestra, which is why referenced services get a
service IP.

`volumes`, `networks`, `healthcheck`, `restart`, `secrets`, `configs` and `entrypoint` have no
Oakestra equivalent and are dropped, with a question raised when it matters. Compose files are
capped at 64,000 characters.

## Existing SLA input

The CLI's `--sla`, the HTTP API's `sla` field and the playground's upload button all start from
an SLA you already have instead of a description. The model uses it as the first draft and
leaves it alone unless told otherwise. The positional text, `-f`, stdin, the `description`
field or the playground's chat say what to change. With no notes at all, you get the same SLA
back, verified, with its images checked and any open questions raised.

The SLA doesn't have to be valid: if it fails validation, the problems are handed to the model
to fix. Fields the generator can't represent (`connectivity`, latency or geo constraints,
`bandwidth_in`, `added_files`, ...) are dropped, and the model is told which ones so it can ask
about those that change behavior. The uploaded `customerID` is kept unless you set
`--customer-id`, `customer_id` or the playground's Customer ID explicitly. SLAs are capped at
64,000 characters.

The playground tells uploads apart by content: a JSON object without a `services` key is an
SLA, anything else is a compose file. A `.json` file that doesn't parse counts as an SLA, so
you get the JSON error.

## HTTP API

The server is an optional extra, so the plain CLI install doesn't pull in FastAPI:

```sh
uv sync --extra server                 # or: pip install "oakestra-sla-gen[server]"
uv run oakestra-sla-gen serve          # http://127.0.0.1:8000, OpenAPI docs at /docs
uv run oakestra-sla-gen serve --host 0.0.0.0 --port 9000 --model openai/gpt-oss-20b
```

`serve` accepts the same `--base-url`, `--model`, `--api-key`, `--reasoning-effort` and
`--method` flags (and env vars) as generation. They're fixed at startup; everything else is set
per request. A request can still override the method with its own `method` field, which is
handy for comparing methods against one server.

| Endpoint | Body | Response |
|---|---|---|
| `POST /generate` | `{"description", "compose", "sla", "method", "customer_id", "max_retries"}` | The verified SLA |
| `POST /validate` | An SLA document | `{"valid": bool, "errors": [...]}`, always `200` |

For `/generate`, one of `description`, `compose` or `sla` is required. `compose` and `sla`
take the raw file text and can't be combined. Next to either one, `description` is used as
notes. `method` is optional and defaults to the server's `--method`. `max_retries` is capped
at 10. Error responses:

- `422` with `{"detail", "errors", "last_candidate"}` if no valid SLA came out within
  `max_retries`
- `422` with `{"detail", "questions"}` if the input was too vague to draft anything
- `422` with a readable `msg` if `compose` isn't a usable compose file or `sla` isn't usable
  JSON with at least one application
- `502` if the LLM server failed

`/generate` is single-shot: it doesn't expose the interactive session, so open questions come
back once with no follow-up turn. Use the [playground](#playground) endpoints for a
conversation.

```sh
curl -X POST localhost:8000/generate -H 'content-type: application/json' \
  -d '{"description": "a single nginx web server on port 80 with 1 cpu and 512MB memory"}'
```

## Playground

`serve` always includes the playground session API (`/playground/info`, `/playground/sessions`).
The browser UI for the interactive draft-and-answer loop is the separate [frontend](#frontend);
the API doesn't serve any HTML. For local development, run both:

```sh
uv run oakestra-sla-gen serve    # API on http://127.0.0.1:8000
pnpm --dir frontend install && pnpm --dir frontend dev    # then open http://localhost:5173
```

The dev server proxies `/api` to `127.0.0.1:8000`.

- **Conversation (left pane)** - describe your app, or upload or drag-and-drop a compose file
  or an existing SLA with an optional note, then keep changing the draft through the chat.
  Each round shows whether the draft passed validation, what changed, and the model's open
  questions. Keep each assumption or answer it, then update or accept the
  draft.
- **Visual view (right pane)** - a map of the services, what's reachable from outside and
  which service references another's service IP, followed by a section per service with
  changed fields and validation problems marked.
- **Code view (right pane)** - the editable SLA JSON, re-validated as you type. Clicking a
  problem jumps to its line.
- **History (top bar)** - keeps the latest draft of each session (with your hand edits) in the
  browser's local storage, up to 20 entries. Opening one starts a new session from that SLA,
  because server sessions expire after an hour. Entries can be copied, downloaded or deleted.
  Nothing leaves the browser, but any secrets in the SLAs are stored there until you delete them.

<details>
<summary>Playground endpoints</summary>

| Endpoint | Description |
|---|---|
| `POST /playground/sessions` | Start a session. Same fields as `POST /generate`, plus `check_images`. Returns `{session_id, sla, questions, attempts}`. |
| `POST /playground/sessions/{id}/answer` | Continue a session with `{text}`. Returns the same shape. |
| `DELETE /playground/sessions/{id}` | Drop a session. |
| `GET /playground/info` | Returns `{model}`, shown in the UI header. |

Sessions live only in the server process's memory. They don't survive a restart, aren't shared
across worker processes, and are capped in count and idle time, oldest evicted first.

</details>

## Frontend

The playground UI lives in `frontend/`: Vite, React 19, TypeScript, Tailwind, shadcn/ui,
ai-elements and CodeMirror. Scripts, run from `frontend/` (or with `pnpm --dir frontend`):
`dev`, `build`, `lint`, `typecheck` and `test`.

In production it runs as an nginx container on port 8080 that serves the build and proxies
`/api/*` to the API with the prefix stripped. The upstream is set at runtime with
`API_UPSTREAM`, so the browser only ever talks to one origin.

## Deployment

### Docker

`compose.yaml` builds two images: the HTTP server with the playground API enabled (`sla-gen`,
port 8000) and the playground UI (`frontend`, port 8080).

```sh
docker compose up --build              # API on :8000, playground on http://localhost:8080
PORT=9000 FRONTEND_PORT=9080 docker compose up --build    # if the ports are taken on the host
```

Prebuilt images for amd64 and arm64 are published to `ghcr.io/robertjndw/oakestra-sla-gen` and
`ghcr.io/robertjndw/oakestra-sla-gen-frontend`: `latest` from `main`, plus a version tag for
each `v*` git tag.

The LLM isn't part of the container. By default it talks to LM Studio on the Docker host at
`http://host.docker.internal:1234/v1`. Set `OPENAI_BASE_URL`, `OPENAI_API_KEY`,
`OAKESTRA_SLA_MODEL` and `OAKESTRA_SLA_METHOD` in the environment (or a `.env` file) to point it
somewhere else.

> [!NOTE]
> On Linux, LM Studio has to listen on all interfaces rather than only `127.0.0.1`, or the
> container can't reach it. Docker Desktop on macOS and Windows forwards to the host's
> loopback, so it works as is.

### Oakestra addon

The server can run as an
[Oakestra addon](https://github.com/oakestra/oakestra/tree/develop/addons_engine): the root
orchestrator's addons engine runs the container next to the control plane, on the `oakestra`
Docker network. `oakestra-addon.json` is the marketplace entry for it. It defines two
services: `sla_gen` (the API, port 8000) and `sla_gen_frontend` (the playground UI, port 8080).

1. **Check `environment` in `oakestra-addon.json`.** The addons engine starts the container
   with plain `docker run` options and can't add `extra_hosts`, so `host.docker.internal`
   doesn't resolve. The default, `172.17.0.1`, is the Docker bridge gateway on a Linux host,
   which reaches an LLM server on the root orchestrator host as long as it listens on all
   interfaces. For an LLM elsewhere, use its real address.

   The frontend's `API_UPSTREAM` must reach the API container. The addons engine names
   containers `root_<service_name>` and puts them on the `oakestra` network, so the default is
   `http://root_sla_gen:8000`. If your setup names them differently, use
   `http://172.17.0.1:8000` instead, which works because the API publishes host port 8000.
2. **Register it with the marketplace.** It moves from `under_review` to `approved` once the
   image is pulled, so the GHCR package has to be public (or the root orchestrator host has
   to be logged in to GHCR).

   ```sh
   curl -X POST http://<root-orchestrator>:11102/api/v1/marketplace/addons \
     -H 'content-type: application/json' -d @oakestra-addon.json
   ```

3. **Install it** using the `_id` from the previous response:

   ```sh
   curl -X POST http://<root-orchestrator>:11101/api/v1/addons \
     -H 'content-type: application/json' -d '{"marketplace_id": "<_id>"}'
   ```

The addons dashboard on port 11103 can do the same. The addons monitor polls every 30 seconds
by default, after which the API is at `http://<root-orchestrator>:8000` and the playground at
`http://<root-orchestrator>:8080`.

In `ports`, the key is the container port and the value is the host port (the Docker SDK's
convention; the dashboard's form labels them the other way round), so change the value to move
it off 8000 or 8080.

> [!WARNING]
> Marketplace entries are stored and shown in plain text. Don't put a real API key in
> `oakestra-addon.json` on a shared setup.

## How it works

1. A Pydantic model constrains the LLM to the subset of Oakestra's SLA that its schedulers
   actually use.
2. The output is wrapped into a full SLA and checked against Oakestra's own JSON Schema plus
   semantic checks the schema doesn't cover.
3. Any errors are fed back to the LLM, which retries up to `--max-retries` times.
4. Container images are looked up in their registry, and unusual values (very large resources,
   images the user typed that can't be found) become questions instead of errors.
5. A session wraps this into a conversation, which the CLI's interactive mode and the
   playground build on.

The [design notes](docs/design.md) cover the pipeline in more detail, where Oakestra's docs and
code disagree about the SLA format, and why the default structured output method and model
were chosen.

## Development

```sh
uv sync
uv run ruff check
uv run ruff format
uv run pytest              # fast tests, no network
uv run pytest -m llm       # integration tests against LM Studio, skipped if unreachable
```

The code lives in `src/oakestra_sla_gen/`:

| Module | Purpose |
|---|---|
| `cli.py` | Command-line entry point |
| `generator.py` | LLM calls, retry loop and `SLASession` |
| `models.py` | Pydantic model of the SLA subset the LLM produces |
| `validation.py`, `oakestra_schema.py` | Verifier and the vendored Oakestra JSON Schema |
| `registry.py` | Container image existence checks |
| `compose.py` | Docker Compose input handling |
| `existing_sla.py` | Existing SLA input handling |
| `prompts.py` | System and correction prompts |
| `server.py`, `playground.py` | HTTP API and playground session API |

The browser playground is a separate project in `frontend/`, see [Frontend](#frontend).

`tests/fixtures/` holds SLA fixtures vendored from Oakestra; see the
[design notes](docs/design.md#test-fixtures) for how they're used.
