from __future__ import annotations

import json
import uuid
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from dossier.api.deps import get_embeddings, get_llm, get_repository, get_settings, require_user
from dossier.config import Settings
from dossier.observability.cost import estimate_cost_usd
from dossier.orchestrator import BriefResult, BriefToken, brief_events
from dossier.ports.embeddings import Embeddings
from dossier.ports.llm import Llm
from dossier.ports.repository import Brief, Repository, User

router = APIRouter()


class BriefBody(BaseModel):
    question: str
    conversation_id: str | None = None


class BriefTurnIn(BaseModel):
    question: str
    answer: str = ""
    final: dict | None = None


class UpsertBriefBody(BaseModel):
    title: str | None = None
    conversation_id: str | None = None
    collection_id: str = "default"
    created_at: str | None = None
    turns: list[BriefTurnIn]


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _title(question: str, max_len: int = 72) -> str:
    trimmed = question.strip() or "Brief"
    if len(trimmed) <= max_len:
        return trimmed
    return f"{trimmed[: max_len - 1].rstrip()}…"


def _brief_json(brief: Brief) -> dict:
    return {
        "id": brief.id,
        "title": brief.title,
        "created_at": brief.created_at,
        "updated_at": brief.updated_at,
        "conversation_id": brief.conversation_id,
        "turns": brief.turns,
    }


def _owned_brief(repo: Repository, brief_id: str, user_id: str) -> Brief:
    brief = repo.get_brief(brief_id)
    if brief is None or brief.user_id != user_id:
        raise HTTPException(status_code=404, detail="brief not found")
    return brief


def _final_payload(result: BriefResult, conversation_id: str, cost: float) -> dict:
    return {
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
    }


@router.get("/briefs")
def list_briefs(
    repo: Repository = Depends(get_repository),
    user: User = Depends(require_user),
) -> list[dict]:
    return [_brief_json(brief) for brief in repo.list_briefs(user.id)]


@router.get("/briefs/{brief_id}")
def get_brief(
    brief_id: str,
    repo: Repository = Depends(get_repository),
    user: User = Depends(require_user),
) -> dict:
    return _brief_json(_owned_brief(repo, brief_id, user.id))


@router.put("/briefs/{brief_id}")
def put_brief(
    brief_id: str,
    body: UpsertBriefBody,
    repo: Repository = Depends(get_repository),
    user: User = Depends(require_user),
) -> dict:
    collection_id = body.collection_id or "default"
    if repo.get_collection(collection_id) is None:
        raise HTTPException(status_code=404, detail="collection not found")
    existing = repo.get_brief(brief_id)
    if existing is not None and existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="brief belongs to another user")
    conversation_id = body.conversation_id or brief_id
    repo.ensure_conversation(id=conversation_id, collection_id=collection_id)
    first = body.turns[0].question if body.turns else "Brief"
    saved = repo.upsert_brief(
        id=brief_id,
        user_id=user.id,
        collection_id=collection_id,
        conversation_id=conversation_id,
        title=body.title or (existing.title if existing else _title(first)),
        turns=[turn.model_dump() for turn in body.turns],
        created_at=body.created_at or (existing.created_at if existing else None),
    )
    return _brief_json(saved)


@router.delete("/briefs/{brief_id}", status_code=204)
def delete_brief(
    brief_id: str,
    repo: Repository = Depends(get_repository),
    user: User = Depends(require_user),
) -> None:
    _owned_brief(repo, brief_id, user.id)
    repo.delete_brief(brief_id, user.id)


@router.post("/collections/{collection_id}/brief")
def brief_collection(
    collection_id: str,
    body: BriefBody,
    repo: Repository = Depends(get_repository),
    embeddings: Embeddings = Depends(get_embeddings),
    llm: Llm = Depends(get_llm),
    settings: Settings = Depends(get_settings),
    user: User = Depends(require_user),
) -> StreamingResponse:
    if repo.get_collection(collection_id) is None:
        raise HTTPException(status_code=404, detail="collection not found")

    conversation_id = body.conversation_id or str(uuid.uuid4())
    existing = repo.get_brief(conversation_id)
    if existing is not None and existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="brief belongs to another user")
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
        final = _final_payload(result, conversation_id, cost)
        stored = repo.get_brief(conversation_id)
        turns = list(stored.turns) if stored else []
        turns.append(
            {
                "question": body.question,
                "answer": result.text,
                "final": final,
            }
        )
        repo.upsert_brief(
            id=conversation_id,
            user_id=user.id,
            collection_id=collection_id,
            conversation_id=conversation_id,
            title=stored.title if stored else _title(body.question),
            turns=turns,
            created_at=stored.created_at if stored else None,
        )
        yield _sse("final", final)

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
