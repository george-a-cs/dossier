from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from dossier.db.connection import VecExtensionError, apply_schema, connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.ports.repository import Chunk, ChunkWithEmbedding, Document


def _repo(tmp_path: Path) -> SqliteRepository:
    try:
        conn = connect(tmp_path / "test.db")
    except VecExtensionError as exc:
        pytest.fail(f"sqlite-vec must load in this environment: {exc}")
    return SqliteRepository(conn)


def _chunk(chunk_id: str, collection_id: str, document_id: str, embedding: list[float]) -> ChunkWithEmbedding:
    return ChunkWithEmbedding(
        chunk=Chunk(
            id=chunk_id,
            document_id=document_id,
            collection_id=collection_id,
            chunk_index=0,
            text=f"text {chunk_id}",
            filename="doc.md",
            page_start=1,
            page_end=1,
            section_title="Intro",
        ),
        embedding=embedding,
    )


def test_create_and_get_user(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    created = repo.create_user(
        id="user-1",
        name="George",
        email="george@csegoldi.com",
        password_hash="hashed",
        role="super_admin",
    )
    assert created.email == "george@csegoldi.com"
    assert repo.get_user_by_email("george@csegoldi.com") is not None
    updated = repo.update_user("user-1", name="George C", email="george@csegoldi.com")
    assert updated is not None
    assert updated.name == "George C"
    assert updated.password_hash == "hashed"
    session = repo.create_session(
        id="sess-1",
        user_id="user-1",
        token_hash="abc",
        expires_at="2099-01-01T00:00:00+00:00",
    )
    assert repo.get_session_by_token_hash("abc") == session
    repo.delete_session_by_token_hash("abc")
    assert repo.get_session_by_token_hash("abc") is None


def test_schema_apply_twice(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    apply_schema(repo._conn)
    apply_schema(repo._conn)


def test_insert_and_get_chunk(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    repo.create_collection(
        id="col-a", name="A", embedding_model="fake", embedding_dimensions=3
    )
    repo.upsert_document(
        Document(
            id="doc-1",
            collection_id="col-a",
            filename="doc.md",
            mime="text/markdown",
            byte_size=12,
            status="ready",
            error_code=None,
            page_count=1,
            chunk_count=0,
            source_path=None,
        )
    )
    repo.replace_chunks("doc-1", [_chunk("chk-1", "col-a", "doc-1", [1.0, 0.0, 0.0])])
    got = repo.get_chunk("chk-1")
    assert got is not None
    assert got.text == "text chk-1"
    assert got.section_title == "Intro"
    stored = repo.get_document("doc-1")
    assert stored is not None
    assert stored.category is None
    updated = repo.update_document_meta("doc-1", category="Label", notes="Dose excerpt")
    assert updated is not None
    assert updated.category == "Label"
    assert updated.notes == "Dose excerpt"
    assert repo.update_document_meta("missing", category="SOP", notes=None) is None


def test_vector_knn_and_collection_isolation(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    repo.create_collection(
        id="col-a", name="A", embedding_model="fake", embedding_dimensions=3
    )
    repo.create_collection(
        id="col-b", name="B", embedding_model="fake", embedding_dimensions=3
    )
    for doc_id, collection_id in (("doc-a", "col-a"), ("doc-b", "col-b")):
        repo.upsert_document(
            Document(
                id=doc_id,
                collection_id=collection_id,
                filename="doc.md",
                mime="text/markdown",
                byte_size=12,
                status="ready",
                error_code=None,
                page_count=1,
                chunk_count=0,
                source_path=None,
            )
        )
    repo.replace_chunks("doc-a", [_chunk("chk-a", "col-a", "doc-a", [1.0, 0.0, 0.0])])
    repo.replace_chunks("doc-b", [_chunk("chk-b", "col-b", "doc-b", [0.0, 1.0, 0.0])])

    near_a = repo.search_vector("col-a", [0.95, 0.05, 0.0], k=3)
    assert near_a[0].id == "chk-a"
    assert all(hit.id != "chk-b" for hit in near_a)

    near_b = repo.search_vector("col-b", [0.05, 0.95, 0.0], k=3)
    assert near_b[0].id == "chk-b"
    assert all(hit.id != "chk-a" for hit in near_b)


def test_shared_connection_is_thread_safe(tmp_path: Path) -> None:
    conn = connect(tmp_path / "shared.db")
    writer = SqliteRepository(conn)
    writer.create_collection(
        id="col-a", name="A", embedding_model="fake", embedding_dimensions=3
    )
    writer.upsert_document(
        Document(
            id="doc-1",
            collection_id="col-a",
            filename="doc.md",
            mime="text/markdown",
            byte_size=12,
            status="ready",
            error_code=None,
            page_count=1,
            chunk_count=0,
            source_path=None,
        )
    )
    writer.replace_chunks("doc-1", [_chunk("chk-1", "col-a", "doc-1", [1.0, 0.0, 0.0])])

    def read(_: int) -> None:
        repo = SqliteRepository(conn)
        for _ in range(40):
            assert repo.get_document("doc-1") is not None
            assert repo.list_chunks("doc-1")

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(read, range(8)))


def test_brief_roundtrip_and_backfill(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    repo.create_collection(
        id="col-a", name="A", embedding_model="fake", embedding_dimensions=3
    )
    repo.create_user(
        id="user-1",
        name="George",
        email="george@csegoldi.com",
        password_hash="hashed",
        role="super_admin",
    )
    repo.create_conversation(id="c1", collection_id="col-a")
    saved = repo.upsert_brief(
        id="c1",
        user_id="user-1",
        collection_id="col-a",
        conversation_id="c1",
        title="What is the dose?",
        turns=[{"question": "What is the dose?", "answer": "10 mg", "final": None}],
    )
    assert saved.title == "What is the dose?"
    assert repo.get_brief("c1") is not None
    assert repo.list_briefs("user-1")[0].id == "c1"
    assert repo.list_briefs("other") == []
    assert repo.delete_brief("c1", "user-1") is True
    assert repo.get_brief("c1") is None

    repo.create_conversation(id="c2", collection_id="col-a")
    repo.add_message(conversation_id="c2", role="user", content="Any X-ray?")
    repo.add_message(conversation_id="c2", role="assistant", content="Not in this dossier.")
    assert repo.backfill_orphan_briefs() == 1
    orphan = repo.get_brief("c2")
    assert orphan is not None
    assert orphan.user_id == "user-1"
    assert orphan.turns[0]["final"]["refused"] is True
    assert repo.backfill_orphan_briefs() == 0
