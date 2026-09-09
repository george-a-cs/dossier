from __future__ import annotations

import json
import uuid
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from dossier.api.deps import get_embeddings, get_llm, get_repository, get_settings
from dossier.config import Settings
from dossier.observability.cost import estimate_cost_usd
from dossier.orchestrator import BriefResult, BriefToken, brief_events
from dossier.ports.embeddings import Embeddings
from dossier.ports.llm import Llm
from dossier.ports.repository import Repository

router = APIRouter()


class BriefBody(BaseModel):
    question: str
    conversation_id: str | None = None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/collections/{collection_id}/brief")
def brief_collection(
    collection_id: str,
    body: BriefBody,
    repo: Repository = Depends(get_repository),
    embeddings: Embeddings = Depends(get_embeddings),
    llm: Llm = Depends(get_llm),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    if repo.get_collection(collection_id) is None:
        raise HTTPException(status_code=404, detail="collection not found")

    conversation_id = body.conversation_id or str(uuid.uuid4())
    if body.conversation_id is None:
        repo.create_conversation(id=conversation_id, collection_id=collection_id)
    history = repo.list_recent_messages(conversation_id, limit=4)
    repo.add_message(conversation_id=conversation_id, role="user", content=body.question)

    def events() -> Iterator[str]:
        result: BriefResult | None = None
        for item in brief_events(
            repo=repo,
            embeddings=embeddings,
            llm=llm,
            collection_id=collection_id,
            question=body.question,
            history=history,
        ):
            if isinstance(item, BriefToken):
                yield _sse("token", {"t": item.token})
            else:
                result = item
        assert result is not None
        repo.add_message(conversation_id=conversation_id, role="assistant", content=result.text)
        cost = estimate_cost_usd(
            tokens_embed=0,
            tokens_in=result.stats.tokens_in,
            tokens_out=result.stats.tokens_out,
            price_embed_per_1m=settings.price_embed_per_1m,
            price_llm_in_per_1m=settings.price_llm_in_per_1m,
            price_llm_out_per_1m=settings.price_llm_out_per_1m,
        )
        citation_valid = bool(result.citations) and not result.refused
        repo.insert_query_event(
            request_id=conversation_id,
            collection_id=collection_id,
            embed_ms=result.stats.embed_ms,
            retrieve_ms=result.stats.retrieve_ms,
            llm_ms=result.stats.llm_ms,
            tokens_in=result.stats.tokens_in,
            tokens_out=result.stats.tokens_out,
            cost_usd=cost,
            chunk_ids=result.retrieval_ids,
            models={"llm": llm.model_name, "embeddings": embeddings.model_name},
            citation_valid=citation_valid,
            refused=result.refused,
        )
        yield _sse(
            "final",
            {
                "text": result.text,
                "citations": [
                    {
                        "chunk_id": cite.chunk_id,
                        "document_id": cite.document_id,
                        "filename": cite.filename,
                        "page_start": cite.page_start,
                        "page_end": cite.page_end,
                    }
                    for cite in result.citations
                ],
                "refused": result.refused,
                "retrieval_ids": result.retrieval_ids,
                "rewritten_query": result.rewritten_query,
                "retrieval": [
                    {
                        "chunk_id": row.chunk_id,
                        "filename": row.filename,
                        "rrf_score": row.rrf_score,
                        "rrf_rank": row.rrf_rank,
                        "vector_rank": row.vector_rank,
                        "fts_rank": row.fts_rank,
                        "page_start": row.page_start,
                        "snippet": row.snippet,
                    }
                    for row in result.retrieval
                ],
                "conversation_id": conversation_id,
                "stats": {
                    "embed_ms": result.stats.embed_ms,
                    "retrieve_ms": result.stats.retrieve_ms,
                    "llm_ms": result.stats.llm_ms,
                    "tokens_in": result.stats.tokens_in,
                    "tokens_out": result.stats.tokens_out,
                    "cost_usd": cost,
                },
            },
        )

    return StreamingResponse(events(), media_type="text/event-stream")


@router.get("/collections/{collection_id}/events")
def list_query_events(
    collection_id: str,
    repo: Repository = Depends(get_repository),
) -> list[dict]:
    if repo.get_collection(collection_id) is None:
        raise HTTPException(status_code=404, detail="collection not found")
    return [
        {
            "id": event.id,
            "request_id": event.request_id,
            "collection_id": event.collection_id,
            "embed_ms": event.embed_ms,
            "retrieve_ms": event.retrieve_ms,
            "llm_ms": event.llm_ms,
            "tokens_in": event.tokens_in,
            "tokens_out": event.tokens_out,
            "cost_usd": event.cost_usd,
            "citation_valid": event.citation_valid,
            "refused": event.refused,
            "created_at": event.created_at,
        }
        for event in repo.list_query_events(collection_id)
    ]


@router.get("/chunks/{chunk_id}")
def get_chunk(chunk_id: str, repo: Repository = Depends(get_repository)) -> dict:
    chunk = repo.get_chunk(chunk_id)
    if chunk is None:
        raise HTTPException(status_code=404, detail="chunk not found")
    return {
        "id": chunk.id,
        "document_id": chunk.document_id,
        "text": chunk.text,
        "filename": chunk.filename,
        "page_start": chunk.page_start,
        "page_end": chunk.page_end,
        "section_title": chunk.section_title,
        "chunk_index": chunk.chunk_index,
    }
