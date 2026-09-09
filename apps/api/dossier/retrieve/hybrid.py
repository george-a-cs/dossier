from __future__ import annotations

from dataclasses import dataclass

from dossier.ports.embeddings import Embeddings
from dossier.ports.repository import Repository, RetrievedChunk
from dossier.retrieve.rrf import rrf, rrf_scores
from dossier.retrieve.vector import DEFAULT_K, search_vector


@dataclass(frozen=True)
class RetrievalTrace:
    chunk_id: str
    filename: str
    rrf_score: float
    rrf_rank: int
    vector_rank: int | None
    fts_rank: int | None
    page_start: int | None
    snippet: str


@dataclass(frozen=True)
class HybridResult:
    chunks: list[RetrievedChunk]
    traces: list[RetrievalTrace]


def hybrid_search(
    repo: Repository,
    embeddings: Embeddings,
    collection_id: str,
    query: str,
    k: int = DEFAULT_K,
    query_vec: list[float] | None = None,
) -> list[RetrievedChunk]:
    return hybrid_retrieve(
        repo, embeddings, collection_id, query, k=k, query_vec=query_vec
    ).chunks


def hybrid_retrieve(
    repo: Repository,
    embeddings: Embeddings,
    collection_id: str,
    query: str,
    k: int = DEFAULT_K,
    query_vec: list[float] | None = None,
) -> HybridResult:
    vector = query_vec if query_vec is not None else embeddings.embed_texts([query])[0]
    vector_hits = search_vector(repo, collection_id, vector, k=k)
    fts_hits = repo.search_fts(collection_id, query, k)
    if not fts_hits:
        return _result(vector_hits[:k], vector_hits, [])
    if not vector_hits:
        return _result(fts_hits[:k], [], fts_hits)

    by_id = {hit.id: hit for hit in [*vector_hits, *fts_hits]}
    lists = [[hit.id for hit in vector_hits], [hit.id for hit in fts_hits]]
    fused_ids = rrf(lists)
    scores = rrf_scores(lists)
    ranked: list[RetrievedChunk] = []
    for chunk_id in fused_ids[:k]:
        hit = by_id[chunk_id]
        ranked.append(
            RetrievedChunk(
                id=hit.id,
                document_id=hit.document_id,
                text=hit.text,
                score=scores[chunk_id],
                filename=hit.filename,
                page_start=hit.page_start,
                page_end=hit.page_end,
                section_title=hit.section_title,
                chunk_index=hit.chunk_index,
            )
        )
    return _result(ranked, vector_hits, fts_hits)


def _result(
    chunks: list[RetrievedChunk],
    vector_hits: list[RetrievedChunk],
    fts_hits: list[RetrievedChunk],
) -> HybridResult:
    vector_rank = {hit.id: index for index, hit in enumerate(vector_hits, start=1)}
    fts_rank = {hit.id: index for index, hit in enumerate(fts_hits, start=1)}
    traces = [
        RetrievalTrace(
            chunk_id=chunk.id,
            filename=chunk.filename,
            rrf_score=chunk.score,
            rrf_rank=index,
            vector_rank=vector_rank.get(chunk.id),
            fts_rank=fts_rank.get(chunk.id),
            page_start=chunk.page_start,
            snippet=chunk.text[:120],
        )
        for index, chunk in enumerate(chunks, start=1)
    ]
    return HybridResult(chunks=chunks, traces=traces)
