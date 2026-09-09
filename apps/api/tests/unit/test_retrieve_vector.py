from pathlib import Path

from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.ports.repository import Chunk, ChunkWithEmbedding, Document
from dossier.retrieve.vector import search_vector


def _setup(tmp_path: Path) -> SqliteRepository:
    repo = SqliteRepository(connect(tmp_path / "t.db"))
    repo.create_collection(id="col-a", name="A", embedding_model="fake", embedding_dimensions=3)
    repo.create_collection(id="col-b", name="B", embedding_model="fake", embedding_dimensions=3)
    for doc_id, collection_id, embedding in (
        ("doc-a", "col-a", [1.0, 0.0, 0.0]),
        ("doc-b", "col-b", [0.0, 1.0, 0.0]),
    ):
        repo.upsert_document(
            Document(
                id=doc_id,
                collection_id=collection_id,
                filename="doc.md",
                mime="text/markdown",
                byte_size=4,
                status="ready",
                error_code=None,
                page_count=1,
                chunk_count=0,
                source_path=None,
            )
        )
        repo.replace_chunks(
            doc_id,
            [
                ChunkWithEmbedding(
                    chunk=Chunk(
                        id=f"chk-{collection_id}",
                        document_id=doc_id,
                        collection_id=collection_id,
                        chunk_index=0,
                        text=collection_id,
                        filename="doc.md",
                        page_start=1,
                        page_end=1,
                        section_title=None,
                    ),
                    embedding=embedding,
                )
            ],
        )
    return repo


def test_nearer_neighbour_wins(tmp_path: Path) -> None:
    repo = _setup(tmp_path)
    hits = search_vector(repo, "col-a", [0.9, 0.1, 0.0], k=3)
    assert hits[0].id == "chk-col-a"


def test_collection_does_not_leak(tmp_path: Path) -> None:
    repo = _setup(tmp_path)
    hits = search_vector(repo, "col-a", [0.9, 0.1, 0.0], k=8)
    assert all(hit.id != "chk-col-b" for hit in hits)


def test_k_one(tmp_path: Path) -> None:
    repo = _setup(tmp_path)
    hits = search_vector(repo, "col-a", [1.0, 0.0, 0.0], k=1)
    assert len(hits) == 1


def test_empty_collection(tmp_path: Path) -> None:
    repo = SqliteRepository(connect(tmp_path / "empty.db"))
    repo.create_collection(id="empty", name="E", embedding_model="fake", embedding_dimensions=3)
    assert search_vector(repo, "empty", [1.0, 0.0, 0.0], k=8) == []
