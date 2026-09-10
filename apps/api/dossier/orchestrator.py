from __future__ import annotations

import time
from collections.abc import Iterator
from dataclasses import dataclass, field

from dossier.generate.citations import (
    apply_refuse_policy,
    claimed_ids_from_answer,
    verify_citations,
)
from dossier.generate.pack import pack
from dossier.generate.prompts import SYSTEM_PROMPT, build_user_message, history_to_messages
from dossier.generate.rewrite import rewrite_question
from dossier.ports.embeddings import Embeddings
from dossier.ports.llm import Llm
from dossier.ports.repository import ChatMessage, Repository
from dossier.retrieve.hybrid import RetrievalTrace, hybrid_retrieve

HISTORY_LIMIT = 4


@dataclass(frozen=True)
class BriefCitation:
    chunk_id: str
    document_id: str
    filename: str
    page_start: int | None
    page_end: int | None


@dataclass(frozen=True)
class BriefStats:
    embed_ms: float
    retrieve_ms: float
    llm_ms: float
    tokens_in: int
    tokens_out: int
    cost_usd: float = 0.0


@dataclass(frozen=True)
class BriefResult:
    text: str
    citations: list[BriefCitation]
    refused: bool
    retrieval_ids: list[str]
    stats: BriefStats
    rewritten_query: str = ""
    retrieval: list[RetrievalTrace] = field(default_factory=list)


@dataclass(frozen=True)
class BriefToken:
    token: str


def brief_events(
    *,
    repo: Repository,
    embeddings: Embeddings,
    llm: Llm,
    collection_id: str,
    question: str,
    history: list[ChatMessage] | None = None,
) -> Iterator[BriefToken | BriefResult]:
    rewritten = rewrite_question(question, history or [], llm)

    started = time.perf_counter()
    query_vec = embeddings.embed_texts([rewritten])[0]
    embed_ms = (time.perf_counter() - started) * 1000

    started = time.perf_counter()
    found = hybrid_retrieve(
        repo, embeddings, collection_id, rewritten, k=8, query_vec=query_vec
    )
    retrieve_ms = (time.perf_counter() - started) * 1000
    retrieved = found.chunks

    if not retrieved:
        yield _empty_result(embed_ms, retrieve_ms, rewritten)
        return

    packed = pack(retrieved)
    messages = history_to_messages(history or [], limit=HISTORY_LIMIT)
    messages = [
        *messages,
        ChatMessage(role="user", content=build_user_message(rewritten, packed.prompt)),
    ]

    started = time.perf_counter()
    final_text = ""
    claimed: list[str] = []
    tokens_in = 0
    tokens_out = 0
    for event in llm.stream_answer(system=SYSTEM_PROMPT, messages=messages):
        if event.token:
            yield BriefToken(event.token)
        if event.is_final:
            final_text = event.text or ""
            claimed = event.claimed_chunk_ids or []
            if event.usage:
                tokens_in = event.usage.tokens_in
                tokens_out = event.usage.tokens_out
    llm_ms = (time.perf_counter() - started) * 1000

    display, extracted = claimed_ids_from_answer(final_text)
    if display:
        final_text = display
    claimed = list(dict.fromkeys([*claimed, *extracted]))
    verify = verify_citations(claimed, set(packed.ids))
    text, refused = apply_refuse_policy(final_text, verify)
    citations = _citations(repo, verify.kept) if not refused else []
    yield BriefResult(
        text=text,
        citations=citations,
        refused=refused,
        retrieval_ids=packed.ids,
        rewritten_query=rewritten,
        retrieval=list(found.traces),
        stats=BriefStats(
            embed_ms=round(embed_ms, 2),
            retrieve_ms=round(retrieve_ms, 2),
            llm_ms=round(llm_ms, 2),
            tokens_in=tokens_in,
            tokens_out=tokens_out,
        ),
    )


def brief(**kwargs) -> BriefResult:
    result: BriefResult | None = None
    for event in brief_events(**kwargs):
        if isinstance(event, BriefResult):
            result = event
    assert result is not None
    return result


def _empty_result(
    embed_ms: float, retrieve_ms: float, rewritten_query: str = ""
) -> BriefResult:
    from dossier.generate.citations import REFUSAL_TEXT

    return BriefResult(
        text=REFUSAL_TEXT,
        citations=[],
        refused=True,
        retrieval_ids=[],
        rewritten_query=rewritten_query,
        retrieval=[],
        stats=BriefStats(
            embed_ms=round(embed_ms, 2),
            retrieve_ms=round(retrieve_ms, 2),
            llm_ms=0.0,
            tokens_in=0,
            tokens_out=0,
        ),
    )


def _citations(repo: Repository, kept: list[str]) -> list[BriefCitation]:
    citations: list[BriefCitation] = []
    for chunk_id in kept:
        chunk = repo.get_chunk(chunk_id)
        if chunk is None:
            continue
        citations.append(
            BriefCitation(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                filename=chunk.filename,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
            )
        )
    return citations
