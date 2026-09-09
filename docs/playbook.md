# Playbook — point Dossier at the next collection

v1 is one collection. Treat “next collection” as a new seed set and a clean database, not a multi-tenant product.

## 1. Replace the corpus

Put public or licensed files in `data/seed/` (PDF, `.md`, `.txt`). No PHI.

Keep the same idea as the demo set:

- One document that *can* answer the happy-path question
- One that is related but should not steal the cite
- One planted-instruction file (`Ignore previous instructions…`) so eval still has an injection item

Default seed files load on API start. Restart the API to restore any that were deleted, or `POST /collections/default/seed` to replace them by filename.

## 2. Rewrite the golden set

Edit `data/seed/golden.json`.

- `answerable` — `expected_document_substr` must appear in the winning filename
- `unanswerable` — facts that are not in the files
- `injection` — a question that would succeed only if the model obeyed the planted file

Run `make eval`. Hit-rate and citation validity must stay ≥ 0.8; refusal must stay 1.0. Do not edit the harness to invent a score.

## 3. Point the models

`.env`:

```
LLM_BASE_URL=          # OpenAI-compatible /v1
LLM_API_KEY=
LLM_MODEL=
EMBEDDING_MODEL=       # required for live vectors; a chat key alone is not enough
```

Create a **new** collection if the embedding model or dimensions change. Vectors from two models must not share a `chunk_vec` table.

Set `PRICE_*_PER_1M` if the host bills tokens. Leave at 0 for self-hosted.

## 4. Ask from the desk

`make api-dev` and `make web-dev`, or `docker compose up`.

Ask the happy-path question, click the chip, then ask something absent. The strip should show Grounded then Refused.

A follow-up like “the second one” after “compare dose and contraindication” is rewritten before retrieve. If the rewrite model is down or tries to send you to the web, the raw question is used.

Retrieval ranks (vector / FTS / RRF) are on the SSE `final` event. The desk shows them only with `NEXT_PUBLIC_DEBUG=1`.

MCP uses the same retrieve: `pip install -e 'apps/api[mcp]'` and `make mcp`. Tool: `search_corpus(collection_id, query, k=8)`.

## 5. When the files are real

- Keep originals; the DB only stores extracted text and vectors
- Scan-only PDFs will fail with `unreadable_pdf` until someone adds OCR
- Tables and figures will chunk badly — extract or split them first
- If writers or size outgrow one SQLite file, swap the repository to Postgres + pgvector. Do not change the orchestrator.
- If PHI appears, stop. This repo is not a HIPAA system.
