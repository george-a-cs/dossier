from __future__ import annotations

from dossier.ports.repository import Repository, RetrievedChunk

DEFAULT_K = 8


def search_vector(
    repo: Repository,
    collection_id: str,
    query_embedding: list[float],
    k: int = DEFAULT_K,
) -> list[RetrievedChunk]:
    """Nearest chunks by sqlite-vec distance (lower is closer)."""
    return repo.search_vector(collection_id, query_embedding, k)
