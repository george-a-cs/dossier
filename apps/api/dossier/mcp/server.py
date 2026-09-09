from __future__ import annotations

from pathlib import Path

from dossier.config import get_settings
from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.openai_embeddings import CompatibleEmbeddings
from dossier.ports.embeddings import Embeddings
from dossier.retrieve.hybrid import hybrid_search


def _embeddings() -> Embeddings:
    settings = get_settings()
    if settings.embedding_model:
        return CompatibleEmbeddings(
            base_url=settings.resolved_embedding_base_url(),
            api_key=settings.resolved_embedding_api_key(),
            model_name=settings.embedding_model,
            dimensions=settings.embedding_dimensions,
        )
    return FakeEmbeddings()


def search_corpus(collection_id: str, query: str, k: int = 8) -> list[dict]:
    """Same retrieve path as HTTP briefing."""
    settings = get_settings()
    repo = SqliteRepository(connect(Path(settings.database_path)))
    hits = hybrid_search(repo, _embeddings(), collection_id, query, k=k)
    return [
        {
            "id": hit.id,
            "filename": hit.filename,
            "page_start": hit.page_start,
            "text": hit.text,
            "score": hit.score,
        }
        for hit in hits
    ]


def main() -> None:
    try:
        from mcp.server.fastmcp import FastMCP
    except ImportError as exc:
        raise SystemExit("Install the mcp extra: pip install -e 'apps/api[dev]' mcp") from exc

    mcp = FastMCP("dossier")

    @mcp.tool()
    def search_corpus_tool(collection_id: str, query: str, k: int = 8) -> list[dict]:
        return search_corpus(collection_id, query, k)

    mcp.run()


if __name__ == "__main__":
    main()
