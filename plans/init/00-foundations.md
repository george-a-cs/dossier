# Wave 0 — Foundations

**Goal.** A stranger can clone, configure, and hit `/healthz`. No RAG yet.

**Depends on.** Nothing.

**Exit.** `make api-dev` or Compose; `/healthz` and `/readyz` 200; repository tests green; routes contain no SQL.

---

## Phase 0.1 — Conventions and skeleton

**Why.** Repeatable structure is the quality bar. A sloppy tree infects every later phase.

### Create

```
dossier/
  .gitignore
  .env.example
  Makefile
  AGENTS.md
  docker-compose.yml          # stub ok until 0.3
  apps/api/
    pyproject.toml            # or requirements.txt + requirements-dev.txt
    dossier/
      __init__.py
      config.py               # stub
      orchestrator.py         # empty module
      db/          __init__.py
      ports/       __init__.py
      ingest/      __init__.py
      retrieve/    __init__.py
      generate/    __init__.py
      api/         __init__.py
      observability/ __init__.py
    tests/
      unit/.gitkeep
      api/.gitkeep
      fixtures/.gitkeep
  apps/web/                   # Next.js App Router, TypeScript
  apps/mcp/.gitkeep
  data/seed/.gitkeep
  data/files/.gitkeep
  docs/build-notes.md
  plans/                      # already exists
```

### `.gitignore` must include

```
.env
data/dossier.db
data/dossier.db-*
data/files/*
!data/files/.gitkeep
node_modules
.next
__pycache__
.venv
dist
```

### `.env.example` (placeholders only — never commit real keys)

```
# OpenAI-compatible endpoint. Default = self-hosted ollama-swap.
# OpenAI:  LLM_BASE_URL=https://api.openai.com/v1
LLM_BASE_URL=https://llm.example.com/v1
LLM_API_KEY=
LLM_MODEL=researcher-internal

# Defaults to LLM_* if omitted
EMBEDDING_BASE_URL=
EMBEDDING_API_KEY=
EMBEDDING_MODEL=

DATABASE_PATH=./data/dossier.db
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=INFO
```

Copy to `.env` locally. Lab chat models: `researcher-internal`, `content-generation`, `voice-fast`. `EMBEDDING_MODEL` must be a name that implements `POST /v1/embeddings` on that host — probe `/v1/models` at implement time.

Add `PRICE_*` later in 4.3 if useful. For a self-hosted lab, default prices can be `0`.

### `AGENTS.md` must state

- Package layout above
- Routes depend on services; services depend on ports; `sqlite_repo` is the only SQL
- Documents are untrusted data
- No LangChain / LlamaIndex
- No PHI in fixtures or screenshots
- Tests use a temp DB, never `data/dossier.db`

### Makefile (minimum)

```
api-dev   # uvicorn dossier.api.app:app --reload --app-dir apps/api
web-dev
test
lint
```

`up` / `eval` wait until 0.3 / 4.5.

### Out

Business logic, UI chrome. Compose can stay a stub until 0.3.

### Acceptance

- [ ] `python -c "import dossier"` works from `apps/api` with the venv
- [ ] `pytest` collects 0 tests and exits 0
- [ ] `apps/web` `tsc --noEmit` and lint clean on the placeholder page
- [ ] `.env.example` has the keys above and is not `.env`

---

## Phase 0.2 — Config, logging, health

**Why.** Reviewers judge 12-factor and operability before they judge RAG.

### Files

| File | Responsibility |
|---|---|
| `dossier/config.py` | pydantic-settings; all env keys; `database_path` as `Path` |
| `dossier/observability/logging.py` | structlog JSON; bind `request_id` |
| `dossier/api/app.py` | FastAPI factory |
| `dossier/api/middleware.py` | generate/propagate `X-Request-Id` |
| `dossier/api/routes_health.py` | `/healthz`, `/readyz` |
| `tests/api/test_health.py` | 200s |

### Behaviour

- `GET /healthz` — process is up. No DB required.
- `GET /readyz` — can open `DATABASE_PATH` (create parent dirs) **and** load sqlite-vec. 503 with a clear body if the extension is missing.
- CORS allowlist from `CORS_ORIGIN` only.
- Access logs include `request_id`, method, path, status, duration_ms. No document bodies.

### Tests

- Config reads defaults when env is empty (except API key may be empty string).
- Health 200 without a corpus.
- Ready 503 if connection helper is stubbed to fail (or if vec load fails in a unit with a monkeypatch).

### Acceptance

- [ ] `curl -s localhost:8000/healthz` → `{"status":"ok"}`
- [ ] Logs are one JSON object per line, not `print`
- [ ] Missing vec extension is a loud ready failure, not a silent cosine fallback

---

## Phase 0.3 — SQLite, schema, repository port

**Why.** The Postgres migrate story is only honest if SQL does not leak into routes.

### Connection

`dossier/db/connection.py`

- `sqlite3.connect(path, check_same_thread=False)` (FastAPI threadpool) or a documented single-thread policy
- `PRAGMA journal_mode=WAL`
- `PRAGMA foreign_keys=ON`
- Load sqlite-vec with the official Python helper (`sqlite_vec.load(conn)`). Comment the import so a reviewer sees how Docker must install it.
- Apply `schema.sql` on boot (idempotent).
- Tests pass `tmp_path / "test.db"`.

### Schema (logical)

`collections`

- `id` TEXT PK
- `name` TEXT
- `embedding_model` TEXT NOT NULL
- `embedding_dimensions` INTEGER NOT NULL
- `created_at`

`documents`

- `id` TEXT PK
- `collection_id` FK
- `filename`, `mime`, `byte_size`
- `status` — `queued | parsing | chunking | embedding | ready | failed`
- `error_code` nullable (`unreadable_pdf`, `unsupported_type`, `too_large`, …)
- `page_count`, `chunk_count`
- `source_path` (under `data/files/`)

`chunks`

- `id` TEXT PK
- `document_id`, `collection_id`
- `chunk_index` INTEGER
- `text`
- `filename`, `page_start`, `page_end`, `section_title`

`chunk_vec` — sqlite-vec virtual table, one row per chunk, dimension = collection’s `embedding_dimensions`.

`chunks_fts` — FTS5 on `text`, content tied to `chunks.id` (create now; query in Wave 4).

`conversations` / `messages` — enough to store last 4 turns (`role`, `content`, `created_at`).

`query_events` — create the table now; writers land in 4.3. Columns: `id`, `request_id`, `collection_id`, `embed_ms`, `retrieve_ms`, `llm_ms`, `tokens_in`, `tokens_out`, `cost_usd`, `chunk_ids` (JSON), `models` (JSON), `citation_valid`, `refused`, `created_at`.

### Port

`dossier/ports/repository.py` — `Protocol` / ABC, not a god object. Minimum methods for Wave 0–2:

```
create_collection(...)
get_collection(id)
upsert_document(...)
list_documents(collection_id)
get_document(id)
replace_chunks(document_id, chunks_with_embeddings)
get_chunk(id)
search_vector(collection_id, embedding, k) -> list[RetrievedChunk]
```

Add `search_fts` in 4.1. Add `insert_query_event` in 4.3.

`RetrievedChunk`: `id`, `document_id`, `text`, `score`, `filename`, `page_start`, `page_end`, `section_title`, `chunk_index`.

`dossier/db/sqlite_repo.py` implements the port. No other module imports `sqlite3`.

### Tests (`tests/unit/test_repository.py`)

- Connect loads sqlite-vec (skip or fail loud if the runner cannot).
- Schema apply twice does not error.
- Insert chunk + `get_chunk`.
- Two tiny fixture vectors (e.g. `[1,0,0…]` vs `[0,1,0…]`); kNN returns the near neighbour.
- Search filtered by `collection_id` does not leak.

### Compose

```
services:
  api:   build apps/api, volume ./data, env_file, port 8000
  web:   build apps/web, NEXT_PUBLIC_API_URL, port 3000
```

API image: Python 3.12, `sqlite-vec` in requirements. Confirm `readyz` is green inside the container.

### Out

FTS query implementation (table only). Live embeddings.

### Acceptance

- [ ] Repository tests green on a temp file
- [ ] `grep -r sqlite3 apps/api/dossier/api` is empty
- [ ] `docker compose up` → both health checks (or documented `make api-dev` if Compose image is still being baked — prefer Compose green here)
- [ ] Note in `docs/build-notes.md`: how vec is loaded, WAL, why a repository port

**Wave 0 exit.** Foundations only. Do not start parsing until this is boring.
