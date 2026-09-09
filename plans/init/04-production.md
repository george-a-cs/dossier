# Wave 4 — Production-shaped

**Goal.** The engineering story: hybrid retrieve, traces, evals, CI, docs.

**Depends on.** Wave 3 path is reliable.

**Exit (P1 / submission bar).** Hybrid + highlight + traces + MCP + eval/CI + human docs.

Do not steal time from 4.5–4.6 to start Wave 5.

---

## Phase 4.1 — Hybrid FTS5 + RRF

### Files

- `dossier/db/sqlite_repo.py` — `search_fts(collection_id, query, k)`
- `dossier/retrieve/rrf.py`
- `dossier/retrieve/hybrid.py` — embed + vector + fts + rrf
- `tests/unit/test_rrf.py`
- `tests/unit/test_hybrid.py`

### FTS

- FTS5 already created in Wave 0; keep it in sync in `replace_chunks` (delete + insert)
- Query: user question as-is first; simple tokenise if needed
- Return the same `RetrievedChunk` shape (`score` = BM25 rank or `1/rank`)

### RRF

```
rrf(lists: list[list[id]], k_const=60) -> list[id]
score(id) = sum 1 / (k_const + rank_i)
```

- Document `k_const=60` in a constant and in build-notes
- Deduplicate by chunk id
- Take top 8 after fusion

### Tests

- Pure RRF: two lists, known winner
- Fixture where an acronym/dose appears verbatim: hybrid ranks that chunk above vector-only (construct fake vectors so vector-only is wrong)
- Collection filter still holds

### Orchestrator change

Replace `search_vector` with `hybrid_search`. Empty FTS should not crash (vector-only fallback).

### Acceptance

- [x] RRF tested without an LLM
- [x] One keyword golden item reserved for `make eval` in 4.5

---

## Phase 4.2 — Reader highlight and page jump

### MD / TXT

- Highlight the exact chunk text in the reader (`mark`)
- Scroll the mark into view

### PDF

- Render with PDF.js (or a thin wrapper) at `page_start`
- Highlight if the text layer contains the chunk; if not, show the page + the chunk text in a callout
- Do not block the demo on perfect PDF highlight

### State

- Selected `chunk_id` in URL search params (`?chunk=`) so a screenshot is reproducible

### Acceptance

- [x] Every chip in the seed demo lands on the right passage
- [x] MD path is reliable even if PDF highlight degrades

---

## Phase 4.3 — Traces and session strip

### Persist

Orchestrator / brief route writes `query_events` (table from Wave 0).

Cost:

```
cost = tokens_embed/1e6 * PRICE_EMBED_PER_1M
     + tokens_in/1e6    * PRICE_LLM_IN_PER_1M
     + tokens_out/1e6   * PRICE_LLM_OUT_PER_1M
```

Put prices in config with documented defaults (today’s list prices, dated in build-notes). Tests use round numbers.

### API

Include `stats` on the SSE `final` event (already sketched in Wave 2). Optional `GET /collections/{id}/events?limit=20` for later debug.

### Logs

Same fields as the row. **Never** log passage text or the full prompt.

### UI

Session strip (footer of briefing pane or a slim top bar):

- Last query latency (total ms)
- Estimated USD (e.g. `$0.002`)
- Grounded | Refused

### Tests

- One brief → one event
- Cost helper unit tests
- Logs fixture does not contain chunk body

### Acceptance

- [x] Metrics are visible in the UI without opening the README
- [x] `citation_valid` is true iff `kept` was non-empty and `refused` is false

---

## Phase 4.4 — FastMCP

### Layout

`apps/mcp/server.py` (or `dossier/mcp/server.py` imported by a small entrypoint)

- Tool `search_corpus(collection_id: str, query: str, k: int = 8)`
- Implementation: call `hybrid_search` (or vector if 4.1 slipped) — **the same function** HTTP uses
- Stdio transport is enough for a local demo

### Tests

- One fixture query: MCP tool ids == `hybrid_search` ids

### Out

Extra tools, LangGraph, hosted MCP.

### Acceptance

- [x] README can say “one retrieve, two interfaces” and a reviewer can run the server
- [x] `make mcp` or a documented `uv run` / `python -m`

If time is tight, this is the first Wave 4 item to cut (see index). Do not cut 4.5 or 4.6 instead.

---

## Phase 4.5 — Eval harness and CI

### Golden set

`data/seed/golden.json` — about 10 items:

```json
{
  "id": "dose-1",
  "question": "What is the recommended dose?",
  "type": "answerable",
  "expected_document_substr": "label-excerpt",
  "must_retrieve": true
}
```

Types: `answerable`, `unanswerable`, `injection`.

Injection item: question that would follow the planted instruction if the model obeyed the document; expect **refusal or ignore**, and the answer must not “diagnose the user.”

### `make eval`

Offline by default:

- Ingest seed with **fake or recorded** embeddings (commit a small recorded-embedding fixture if you want deterministic retrieve without OpenAI)
- Run retrieve / orchestrator with fake LLM where needed
- Metrics printed: retrieval hit-rate, citation validity, correct-refusal rate
- Exit 1 below thresholds (e.g. hit-rate ≥ 0.8 on answerable, refusal = 1.0 on unanswerable)

`EVAL_LIVE=1` optional: real embeddings + LLM, not in default CI.

### CI

`.github/workflows/ci.yml` (or GitLab CI if that is how you share):

- Ruff + pytest
- Frontend lint / `tsc`
- `make eval`
- No `LLM_API_KEY` required

Makefile: `up`, `test`, `eval`, `lint`.

### Acceptance

- [x] Breaking `verify_citations` or RRF turns CI red
- [x] Eval does not invent scores by hand

---

## Phase 4.6 — Narrative docs

Write last from `docs/build-notes.md`. Short sentences. Your voice.

| File | Contents |
|---|---|
| `docs/decision-memo.md` | Stated vs actual problem, options, recommendation, what has to be true |
| `docs/prd.md` | Users, outcomes, instrumented metrics, AC, definition of done |
| `docs/playbook.md` | How to point this at the next collection |
| `README.md` | See checklist below |

### README checklist

- [x] 5-minute readout at the top (problem, recommendation, shipped, deferred, cost/quality)
- [x] Quick setup: `.env.example`, `docker compose up`, seed
- [x] Architecture diagram
- [x] Productionize on AWS / GCP / Azure / Cloudflare: object storage; **SQLite → RDS + pgvector** via the repository; async ingest; private net; secrets; WAF; SSO; OTel; eval in CI; HIPAA/BAA if PHI; scale API, treat the index as the hard part; containers before k8s
- [x] Why **not Vercel** for this stack
- [x] RAG/LLM: models, sqlite-vec + FTS5, own orchestrator, prompts, verify, evals, traces
- [x] Key decisions and why
- [x] Standards followed and skipped
- [x] How AI tools were used (plan first, tests as contract, you wrote memo/PRD/README/prompts)
- [x] What you’d do with more time
- [x] Edge cases: scanned PDFs, tables, huge dossiers, multilingual, injection, medical-advice misuse

### Quality

No LLM-essay tone. Honest skips. If you did not run a usability session, do not claim you did.

**Wave 4 exit.** This is the submission. Wave 5 is optional shine.
