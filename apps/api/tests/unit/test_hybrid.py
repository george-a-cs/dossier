from pathlib import Path

from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ports.repository import Chunk, ChunkWithEmbedding, Document
from dossier.retrieve.hybrid import hybrid_retrieve, hybrid_search
from dossier.retrieve.vector import search_vector


def _repo(tmp_path: Path) -> SqliteRepository:
    repo = SqliteRepository(connect(tmp_path / "h.db"))
    repo.create_collection(id="default", name="D", embedding_model="fake", embedding_dimensions=3)
    return repo


def _add(repo: SqliteRepository, *, chunk_id: str, text: str, embedding: list[float]) -> None:
    doc_id = f"doc-{chunk_id}"
    repo.upsert_document(
        Document(
            id=doc_id,
            collection_id="default",
            filename=f"{chunk_id}.md",
            mime="text/markdown",
            byte_size=len(text),
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
                    id=chunk_id,
                    document_id=doc_id,
                    collection_id="default",
                    chunk_index=0,
                    text=text,
                    filename=f"{chunk_id}.md",
                    page_start=1,
                    page_end=1,
                    section_title=None,
                ),
                embedding=embedding,
            )
        ],
    )


def test_hybrid_lifts_verbatim_dose_over_vector_only(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _add(repo, chunk_id="near", text="unrelated fluff about filing codes", embedding=[1.0, 0.0, 0.0])
    _add(repo, chunk_id="dose", text="The labelled dose is 10 mg once daily.", embedding=[0.0, 1.0, 0.0])
    query_vec = [1.0, 0.0, 0.0]
    vector = search_vector(repo, "default", query_vec, k=2)
    assert vector[0].id == "near"
    embeddings = FakeEmbeddings(dimensions=3)
    hybrid = hybrid_search(
        repo, embeddings, "default", "10 mg dose", k=2, query_vec=query_vec
    )
    assert hybrid[0].id == "dose"
    traced = hybrid_retrieve(
        repo, embeddings, "default", "10 mg dose", k=2, query_vec=query_vec
    )
    assert traced.traces[0].chunk_id == "dose"
    assert traced.traces[0].fts_rank == 1
    assert traced.traces[0].rrf_rank == 1


def test_hybrid_respects_collection(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    repo.create_collection(id="other", name="O", embedding_model="fake", embedding_dimensions=3)
    _add(repo, chunk_id="dose", text="The labelled dose is 10 mg.", embedding=[1.0, 0.0, 0.0])
    embeddings = FakeEmbeddings(dimensions=3)
    hits = hybrid_search(repo, embeddings, "other", "10 mg", k=8, query_vec=[1.0, 0.0, 0.0])
    assert hits == []
