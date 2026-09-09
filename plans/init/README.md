# Implementation index

How we build [../dossier.md](../dossier.md). One file per wave under this folder. Do not start phase N+1 until phase N acceptance is green.

Work from `/home/gc/coding/sandbox/dossier`. Keep notes in `docs/build-notes.md`. Narrative docs are written from those notes.

## Ritual (every phase)

1. Write or extend tests first for ingest, retrieve, cite, or RRF.
2. Implement the thinnest pass that makes those tests green.
3. Review the diff as if a client engineer will own it on Monday.
4. Tick acceptance criteria.
5. One-line note in `docs/build-notes.md`.

**Stop rules:** no LangChain, no PHI in fixtures, documents are untrusted data, no `.env` in git, no architecture we cannot defend.

## Waves

| File | Phases | Outcome |
|---|---|---|
| [00-foundations.md](./00-foundations.md) | 0.1–0.3 | Clone, Compose, `/healthz`, repository port |
| [01-ingest.md](./01-ingest.md) | 1.1–1.4 | Bytes in; chunks + vectors + FTS out |
| [02-query.md](./02-query.md) | 2.1–2.4 | Grounded brief via curl (P0 backend) |
| [03-ui.md](./03-ui.md) | 3.1–3.3 | 3-minute briefing path (P0 product) |
| [04-production.md](./04-production.md) | 4.1–4.6 | Hybrid, traces, MCP, eval/CI, docs (P1) |
| [05-polish.md](./05-polish.md) | 5.1–5.3 | Only after Wave 4 |

## Whole-v1 definition of done

A reviewer, with only the README:

1. Copies `.env.example`, runs `docker compose up`
2. Loads seed corpus
3. Asks a briefing question and sees citations
4. Clicks a citation and lands on the passage
5. Asks something absent and sees a refusal
6. Sees latency / cost / grounded on the strip
7. `make test` and `make eval` pass without a live LLM

If that path fails, more features do not help.

## Short clock

Cut from the bottom: Wave 5 → 5.2 → 5.1 → 4.4 (MCP) → 4.2 PDF polish (keep MD highlight).

**Never cut:** citation verify (2.2), chunk tests (1.2), eval (4.5), README (4.6).
