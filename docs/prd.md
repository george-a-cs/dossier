# PRD — Dossier v1

## User

A Medical Affairs or Regulatory analyst preparing a sourced brief from a known document set. Single user, one active collection. Not a clinical system.

## Job

“Answer this from *our* documents. Show me the passage, or tell me it isn’t there.”

## Outcomes

- Seed or upload finishes with a ready document and a chunk count
- A dose-style question returns a short answer and at least one verified citation
- Clicking the citation opens the reader on that passage (`mark`, `?chunk=` in the URL)
- A question the corpus cannot answer returns “Not in this dossier.” and no chips
- The briefing pane shows last-query latency, estimated USD, and Grounded | Refused

## Instrumented metrics

Written to `query_events` on every brief. Shown on the session strip.

| Metric | Meaning |
|---|---|
| Groundedness | `citation_valid`: kept cites non-empty and not refused |
| Correct refusal | `refused` on unanswerable / injection items |
| Latency | `embed_ms` + `retrieve_ms` + `llm_ms` |
| Cost | token counts × `PRICE_*_PER_1M` (0 if unset) |
| Retrieval set | `chunk_ids` only — no passage text |

Offline eval (`make eval`) scores retrieval hit-rate, citation validity, and correct-refusal on `data/seed/golden.json`.

## Acceptance

- [x] Seed corpus loads on API start
- [x] Grounded brief streams and cites a real chunk
- [x] Citation chip jumps to highlighted MD/TXT
- [x] Absent fact is refused
- [x] Injection fixture does not leak “diagnose the user” into the final answer
- [x] Hybrid retrieve has a unit test where a verbatim dose beats vector-only
- [x] `make test` and `make eval` pass without `LLM_API_KEY`
- [x] Follow-up rewrite (or raw question on failure)
- [x] Debug drawer only when `NEXT_PUBLIC_DEBUG=1`
- [ ] PDF.js page jump — skipped; MD path is the demo

## Definition of done (v1)

A clone, a `.env`, `make test`, `make eval`, and `docker compose up` are enough to run the briefing path. README explains the stack, the refuse rule, and how to productionize later. Wave 5 (query rewrite, debug drawer, recorded demo) is optional shine, not this bar.

## Out of scope

Auth, multi-tenant, OCR, Kubernetes, a public URL, PHI, HIPAA program, LangChain.
