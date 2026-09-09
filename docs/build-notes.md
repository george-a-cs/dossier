# Build notes

Keep short, dated lines. README is written from this later.

## 2026-09-08 — Wave 0

- SQLite + WAL. `sqlite_vec.load(conn)` from the `sqlite-vec` Python package; `/readyz` is 503 if the extension is missing (no silent cosine fallback).
- `chunk_vec` is created on first collection with that collection’s embedding dimensions. Later collections must match.
- Repository port (`SqliteRepository`) is the only SQL. Routes do not import `sqlite3`.
- LLM/embeddings are OpenAI-compatible: `LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL`. Default host is the gravi-lab ollama-swap `/v1`. Switch to OpenAI by changing those env vars.
- Keys live in `.env` only.
- `GET /v1/models` on the lab host listed coding-*, research-heavy, vision-docs-*, voice-fast. User-named `researcher-internal` / `content-generation` were not in that list — keep them as requested defaults and confirm chat + embeddings when Wave 1/2 go live. `EMBEDDING_MODEL` still unset.

## 2026-09-08 — Wave 1

- PDF via pypdf (pure Python, simple Docker). Scanned / empty text layer → `unreadable_pdf`.
- Chunker: heading/paragraph first, then 512 / 64 tokens on `cl100k_base` (estimator, not the live model).
- Embeddings port: `FakeEmbeddings` in tests; `CompatibleEmbeddings` posts to `{base_url}/embeddings`. Live embeddings only if `EMBEDDING_MODEL` is set (a chat key alone is not enough).
- Ingest is synchronous. Size cap 10 MB. Seed docs are synthetic; re-seed replaces by filename.

## 2026-09-08 — Wave 2

- sqlite-vec `score` is distance (lower is closer). Pack sorts by that, then token-budget ~3000.
- Refuse policy: if verify keeps no `chunk_id`, replace the answer with “Not in this dossier.” The UI must only render `final.citations`.
- Cites are a trailing `{"chunk_ids":[...]}` line on the model output, stripped before display.
- Empty retrieve skips the LLM.
- Live chat uses `LLM_*` OpenAI-compatible `/chat/completions`. Tests use `FakeLlm`.

## 2026-09-08 — Wave 3

- Three-pane desk: library / reader / briefing. UI talks to the API only via `lib/api.ts`.
- Streamed `{"chunk_ids"}` trailer is stripped in the thread; chips come from `final.citations` only.
- Example questions: dose (answerable) and X-ray document (refusal).
- `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000`.

## 2026-09-08 — Wave 4

- Hybrid retrieve: sqlite-vec kNN + FTS5, fused with RRF (`RRF_K=60`). Empty FTS falls back to vector-only.
- FTS query is tokenised to quoted OR terms so `10 mg` does not blow up MATCH.
- Pack no longer sorts by distance. Incoming order is already ranked; RRF scores are higher-better.
- `query_events` written on every brief. `citation_valid` is true iff kept cites are non-empty and the answer was not refused. Passage text is not stored — ids only.
- Cost helper uses `PRICE_*_PER_1M`. Defaults are 0 (self-hosted). Embed tokens are not counted yet (`tokens_embed=0` on the event).
- Session strip shows total ms, estimated USD, Grounded | Refused.
- Reader: `mark` + `scrollIntoView`. Selected chunk is `?chunk=` so a screenshot is reproducible. PDF.js skipped — MD/TXT highlight is the reliable path.
- MCP: `search_corpus` calls the same `hybrid_search`. `make mcp` / `python -m dossier.mcp`. Optional extra: `pip install -e 'apps/api[mcp]'`.
- Eval: `data/seed/golden.json` (~10 items). Offline FakeEmbeddings + FakeLlm. Thresholds: hit-rate ≥ 0.8, citation validity ≥ 0.8, refusal = 1.0. `make eval`.
- CI: GitHub + GitLab run ruff, pytest, `make eval`, `tsc`. No `LLM_API_KEY`.
- Docs written from these notes. Wave 5 (query rewrite, debug drawer, screenshots) not started.

## 2026-09-08 — Wave 5

- Follow-up rewrite in `generate/rewrite.py`. Empty history skips the call. Failure or a rewrite that mentions the web / a URL falls back to the raw question.
- FakeLlm can script `rewrite_text`. Default rewrite echoes `Latest:`.
- `hybrid_retrieve` returns RRF / vector / FTS ranks. SSE `final.retrieval` is that list (short snippet, not the full passage in `query_events`).
- Debug drawer (`Sources used`) only when `NEXT_PUBLIC_DEBUG=1`. Off in the happy path.
- Screenshot script: `scripts/screenshots.mjs`. Capture failed here (Chromium missing `libatk`, no sudo for install-deps). No video.
- PDF.js still skipped.
