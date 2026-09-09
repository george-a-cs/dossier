# Decision memo

**Date:** 2026-09-08  
**Subject:** How Dossier should answer questions from a document set

## Stated problem

People with a pile of labels, guidance, and SOPs need answers they can defend. Ctrl+F and “paste this into a chatbot” both fail: one is slow, the other has no source.

## Actual problem

The hard part is not generating text. It is *not* generating unsourced text. If the answer is not in the collection, the product has to say so, every time. Citations that point at the wrong page are worse than a blank.

## Options

| Option | Why we dropped it |
|---|---|
| Generic chat-with-PDF | No collection model, weak refuse path, hard to explain |
| Web-browsing agent | Wrong source of truth. We do not want the open web in the answer |
| Fine-tune a model | No labelled data, and retrieval already solves “what is in *these* files” |
| Buy a vendor RAG | Fine later. We needed something we can run, test, and walk through |

## Recommendation

Ship a thin, local RAG:

1. One collection, PDF / Markdown / TXT
2. Chunk, embed, retrieve (vector + FTS, RRF)
3. Generate only from packed passages
4. Drop any `chunk_id` the model invented
5. If nothing survives, replace the answer with “Not in this dossier.”

Keep the store as SQLite + sqlite-vec + FTS5 on disk. Hide it behind a repository port so Postgres + pgvector is an adapter later, not a rewrite.

Do not host this on Vercel. The API is FastAPI with a native extension and a file database. That wants a volume, not a serverless filesystem.

## What has to be true

- A reviewer can click a citation and land on the passage
- Refusal is common and trusted, not a rare error state
- Ingest is visible (parse → chunk → embed)
- CI can fail the retrieve / cite / refuse path without an API key
- Cost per brief is cheap enough to run all day (self-hosted default is $0; set `PRICE_*` if you switch to a billed API)

If those are not true, this is a demo chatbot, not a briefing tool.
