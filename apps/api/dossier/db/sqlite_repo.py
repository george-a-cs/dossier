from __future__ import annotations

import json
import re
import sqlite3
import threading
import uuid
from datetime import UTC, datetime
from functools import wraps

from dossier.db.connection import ensure_vec_table
from dossier.ports.repository import (
    ChatMessage,
    Chunk,
    ChunkWithEmbedding,
    Collection,
    Document,
    QueryEvent,
    RetrievedChunk,
    Session,
    User,
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _fts_match(query: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9]+", query)
    return " OR ".join(f'"{token}"' for token in tokens)


def _document_from_row(row: sqlite3.Row) -> Document:
    return Document(
        id=row["id"],
        collection_id=row["collection_id"],
        filename=row["filename"],
        mime=row["mime"],
        byte_size=row["byte_size"],
        status=row["status"],
        error_code=row["error_code"],
        page_count=row["page_count"],
        chunk_count=row["chunk_count"],
        source_path=row["source_path"],
        created_at=row["created_at"] if "created_at" in row.keys() else None,
        category=row["category"] if "category" in row.keys() else None,
        notes=row["notes"] if "notes" in row.keys() else None,
        ocr_layout=row["ocr_layout"] if "ocr_layout" in row.keys() else None,
    )


def _user_from_row(row: sqlite3.Row) -> User:
    return User(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        role=row["role"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        password_hash=row["password_hash"],
    )


def _chunk_from_row(row: sqlite3.Row) -> Chunk:
    return Chunk(
        id=row["id"],
        document_id=row["document_id"],
        collection_id=row["collection_id"],
        chunk_index=row["chunk_index"],
        text=row["text"],
        filename=row["filename"],
        page_start=row["page_start"],
        page_end=row["page_end"],
        section_title=row["section_title"],
    )


_CONNECTION_LOCKS: dict[int, threading.RLock] = {}
_CONNECTION_LOCKS_GUARD = threading.Lock()


def _lock_for(conn: sqlite3.Connection) -> threading.RLock:
    key = id(conn)
    with _CONNECTION_LOCKS_GUARD:
        lock = _CONNECTION_LOCKS.get(key)
        if lock is None:
            lock = threading.RLock()
            _CONNECTION_LOCKS[key] = lock
        return lock


def _locked(method):
    @wraps(method)
    def wrapper(self: SqliteRepository, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)

    return wrapper


class SqliteRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._lock = _lock_for(conn)

    @_locked
    def create_collection(
        self,
        *,
        id: str,
        name: str,
        embedding_model: str,
        embedding_dimensions: int,
    ) -> Collection:
        ensure_vec_table(self._conn, embedding_dimensions)
        existing_dim = self._existing_vec_dimensions()
        if existing_dim is not None and existing_dim != embedding_dimensions:
            raise ValueError(
                f"chunk_vec is {existing_dim}-d; cannot create a {embedding_dimensions}-d collection"
            )
        self._conn.execute(
            """
            INSERT INTO collections (id, name, embedding_model, embedding_dimensions, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (id, name, embedding_model, embedding_dimensions, _now()),
        )
        self._conn.commit()
        return Collection(
            id=id,
            name=name,
            embedding_model=embedding_model,
            embedding_dimensions=embedding_dimensions,
        )

    @_locked
    def get_collection(self, id: str) -> Collection | None:
        row = self._conn.execute("SELECT * FROM collections WHERE id = ?", (id,)).fetchone()
        if row is None:
            return None
        return Collection(
            id=row["id"],
            name=row["name"],
            embedding_model=row["embedding_model"],
            embedding_dimensions=row["embedding_dimensions"],
        )

    @_locked
    def upsert_document(self, document: Document) -> Document:
        self._conn.execute(
            """
            INSERT INTO documents (
                id, collection_id, filename, mime, byte_size, status, error_code,
                page_count, chunk_count, source_path, created_at, category, notes,
                ocr_layout
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                filename = excluded.filename,
                mime = excluded.mime,
                byte_size = excluded.byte_size,
                status = excluded.status,
                error_code = excluded.error_code,
                page_count = excluded.page_count,
                chunk_count = excluded.chunk_count,
                source_path = excluded.source_path,
                category = excluded.category,
                notes = excluded.notes,
                ocr_layout = excluded.ocr_layout
            """,
            (
                document.id,
                document.collection_id,
                document.filename,
                document.mime,
                document.byte_size,
                document.status,
                document.error_code,
                document.page_count,
                document.chunk_count,
                document.source_path,
                _now(),
                document.category,
                document.notes,
                document.ocr_layout,
            ),
        )
        self._conn.commit()
        stored = self.get_document(document.id)
        assert stored is not None
        return stored

    @_locked
    def list_documents(self, collection_id: str) -> list[Document]:
        rows = self._conn.execute(
            "SELECT * FROM documents WHERE collection_id = ? ORDER BY created_at",
            (collection_id,),
        ).fetchall()
        return [_document_from_row(row) for row in rows]

    @_locked
    def get_document(self, id: str) -> Document | None:
        row = self._conn.execute("SELECT * FROM documents WHERE id = ?", (id,)).fetchone()
        if row is None:
            return None
        return _document_from_row(row)

    @_locked
    def update_document_meta(
        self,
        id: str,
        *,
        category: str | None,
        notes: str | None,
    ) -> Document | None:
        if self.get_document(id) is None:
            return None
        self._conn.execute(
            "UPDATE documents SET category = ?, notes = ? WHERE id = ?",
            (category, notes, id),
        )
        self._conn.commit()
        return self.get_document(id)

    @_locked
    def update_document_ocr_layout(self, id: str, ocr_layout: str | None) -> Document | None:
        if self.get_document(id) is None:
            return None
        self._conn.execute(
            "UPDATE documents SET ocr_layout = ? WHERE id = ?",
            (ocr_layout, id),
        )
        self._conn.commit()
        return self.get_document(id)

    @_locked
    def delete_document(self, id: str) -> bool:
        if self.get_document(id) is None:
            return False
        existing = self._conn.execute(
            "SELECT id FROM chunks WHERE document_id = ?", (id,)
        ).fetchall()
        for row in existing:
            self._conn.execute("DELETE FROM chunk_vec WHERE chunk_id = ?", (row["id"],))
            self._conn.execute("DELETE FROM chunks_fts WHERE chunk_id = ?", (row["id"],))
        self._conn.execute("DELETE FROM chunks WHERE document_id = ?", (id,))
        self._conn.execute("DELETE FROM documents WHERE id = ?", (id,))
        self._conn.commit()
        return True

    @_locked
    def replace_chunks(self, document_id: str, chunks: list[ChunkWithEmbedding]) -> None:
        existing = self._conn.execute(
            "SELECT id FROM chunks WHERE document_id = ?", (document_id,)
        ).fetchall()
        old_ids = [row["id"] for row in existing]
        for chunk_id in old_ids:
            self._conn.execute("DELETE FROM chunk_vec WHERE chunk_id = ?", (chunk_id,))
            self._conn.execute("DELETE FROM chunks_fts WHERE chunk_id = ?", (chunk_id,))
        self._conn.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))

        for item in chunks:
            chunk = item.chunk
            self._conn.execute(
                """
                INSERT INTO chunks (
                    id, document_id, collection_id, chunk_index, text,
                    filename, page_start, page_end, section_title
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk.id,
                    chunk.document_id,
                    chunk.collection_id,
                    chunk.chunk_index,
                    chunk.text,
                    chunk.filename,
                    chunk.page_start,
                    chunk.page_end,
                    chunk.section_title,
                ),
            )
            self._conn.execute(
                "INSERT INTO chunk_vec (chunk_id, embedding) VALUES (?, ?)",
                (chunk.id, json.dumps(item.embedding)),
            )
            self._conn.execute(
                "INSERT INTO chunks_fts (chunk_id, collection_id, text) VALUES (?, ?, ?)",
                (chunk.id, chunk.collection_id, chunk.text),
            )

        self._conn.execute(
            "UPDATE documents SET chunk_count = ? WHERE id = ?",
            (len(chunks), document_id),
        )
        self._conn.commit()

    @_locked
    def get_chunk(self, id: str) -> Chunk | None:
        row = self._conn.execute("SELECT * FROM chunks WHERE id = ?", (id,)).fetchone()
        if row is None:
            return None
        return _chunk_from_row(row)

    @_locked
    def list_chunks(self, document_id: str) -> list[Chunk]:
        rows = self._conn.execute(
            "SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index",
            (document_id,),
        ).fetchall()
        return [_chunk_from_row(row) for row in rows]

    @_locked
    def list_query_events(self, collection_id: str, limit: int = 50) -> list[QueryEvent]:
        rows = self._conn.execute(
            """
            SELECT * FROM query_events
            WHERE collection_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (collection_id, limit),
        ).fetchall()
        return [
            QueryEvent(
                id=row["id"],
                request_id=row["request_id"],
                collection_id=row["collection_id"],
                embed_ms=float(row["embed_ms"] or 0),
                retrieve_ms=float(row["retrieve_ms"] or 0),
                llm_ms=float(row["llm_ms"] or 0),
                tokens_in=int(row["tokens_in"] or 0),
                tokens_out=int(row["tokens_out"] or 0),
                cost_usd=float(row["cost_usd"] or 0),
                citation_valid=bool(row["citation_valid"]),
                refused=bool(row["refused"]),
                created_at=row["created_at"],
            )
            for row in rows
        ]

    @_locked
    def search_vector(
        self,
        collection_id: str,
        embedding: list[float],
        k: int,
    ) -> list[RetrievedChunk]:
        query = json.dumps(embedding)
        # vec0 requires LIMIT on the kNN itself; filter collection after.
        rows = self._conn.execute(
            """
            SELECT chunk_id, distance
            FROM chunk_vec
            WHERE embedding MATCH ?
            ORDER BY distance
            LIMIT ?
            """,
            (query, max(k * 20, 32)),
        ).fetchall()
        hits: list[RetrievedChunk] = []
        for row in rows:
            chunk = self.get_chunk(row["chunk_id"])
            if chunk is None or chunk.collection_id != collection_id:
                continue
            hits.append(
                RetrievedChunk(
                    id=chunk.id,
                    document_id=chunk.document_id,
                    text=chunk.text,
                    score=float(row["distance"]),
                    filename=chunk.filename,
                    page_start=chunk.page_start,
                    page_end=chunk.page_end,
                    section_title=chunk.section_title,
                    chunk_index=chunk.chunk_index,
                )
            )
            if len(hits) >= k:
                break
        return hits

    @_locked
    def search_fts(
        self,
        collection_id: str,
        query: str,
        k: int,
    ) -> list[RetrievedChunk]:
        match = _fts_match(query)
        if not match:
            return []
        try:
            rows = self._conn.execute(
                """
                SELECT chunk_id, bm25(chunks_fts) AS rank
                FROM chunks_fts
                WHERE chunks_fts MATCH ? AND collection_id = ?
                ORDER BY rank
                LIMIT ?
                """,
                (match, collection_id, k),
            ).fetchall()
        except sqlite3.OperationalError:
            return []
        hits: list[RetrievedChunk] = []
        for index, row in enumerate(rows, start=1):
            chunk = self.get_chunk(row["chunk_id"])
            if chunk is None:
                continue
            hits.append(
                RetrievedChunk(
                    id=chunk.id,
                    document_id=chunk.document_id,
                    text=chunk.text,
                    score=1.0 / index,
                    filename=chunk.filename,
                    page_start=chunk.page_start,
                    page_end=chunk.page_end,
                    section_title=chunk.section_title,
                    chunk_index=chunk.chunk_index,
                )
            )
        return hits

    @_locked
    def insert_query_event(
        self,
        *,
        request_id: str,
        collection_id: str,
        embed_ms: float,
        retrieve_ms: float,
        llm_ms: float,
        tokens_in: int,
        tokens_out: int,
        cost_usd: float,
        chunk_ids: list[str],
        models: dict[str, str],
        citation_valid: bool,
        refused: bool,
    ) -> None:
        self._conn.execute(
            """
            INSERT INTO query_events (
                id, request_id, collection_id, embed_ms, retrieve_ms, llm_ms,
                tokens_in, tokens_out, cost_usd, chunk_ids, models,
                citation_valid, refused, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                request_id,
                collection_id,
                embed_ms,
                retrieve_ms,
                llm_ms,
                tokens_in,
                tokens_out,
                cost_usd,
                json.dumps(chunk_ids),
                json.dumps(models),
                int(citation_valid),
                int(refused),
                _now(),
            ),
        )
        self._conn.commit()

    @_locked
    def create_conversation(self, *, id: str, collection_id: str) -> None:
        self._conn.execute(
            "INSERT INTO conversations (id, collection_id, created_at) VALUES (?, ?, ?)",
            (id, collection_id, _now()),
        )
        self._conn.commit()

    @_locked
    def add_message(self, *, conversation_id: str, role: str, content: str) -> None:
        self._conn.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), conversation_id, role, content, _now()),
        )
        self._conn.commit()

    @_locked
    def list_recent_messages(self, conversation_id: str, limit: int = 4) -> list[ChatMessage]:
        rows = self._conn.execute(
            """
            SELECT role, content FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (conversation_id, limit),
        ).fetchall()
        return [ChatMessage(role=row["role"], content=row["content"]) for row in reversed(rows)]

    @_locked
    def create_user(
        self,
        *,
        id: str,
        name: str,
        email: str,
        password_hash: str,
        role: str,
    ) -> User:
        now = _now()
        self._conn.execute(
            """
            INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (id, name, email, password_hash, role, now, now),
        )
        self._conn.commit()
        return User(
            id=id,
            name=name,
            email=email,
            role=role,
            created_at=now,
            updated_at=now,
            password_hash=password_hash,
        )

    @_locked
    def get_user(self, id: str) -> User | None:
        row = self._conn.execute("SELECT * FROM users WHERE id = ?", (id,)).fetchone()
        return _user_from_row(row) if row else None

    @_locked
    def get_user_by_email(self, email: str) -> User | None:
        row = self._conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return _user_from_row(row) if row else None

    @_locked
    def list_users(self) -> list[User]:
        rows = self._conn.execute(
            "SELECT * FROM users ORDER BY created_at ASC"
        ).fetchall()
        return [_user_from_row(row) for row in rows]

    @_locked
    def update_user(
        self,
        id: str,
        *,
        name: str,
        email: str,
        password_hash: str | None = None,
    ) -> User | None:
        existing = self._conn.execute("SELECT * FROM users WHERE id = ?", (id,)).fetchone()
        if existing is None:
            return None
        stored_hash = password_hash if password_hash is not None else existing["password_hash"]
        now = _now()
        self._conn.execute(
            """
            UPDATE users
            SET name = ?, email = ?, password_hash = ?, updated_at = ?
            WHERE id = ?
            """,
            (name, email, stored_hash, now, id),
        )
        self._conn.commit()
        return User(
            id=id,
            name=name,
            email=email,
            role=existing["role"],
            created_at=existing["created_at"],
            updated_at=now,
            password_hash=stored_hash,
        )

    @_locked
    def create_session(
        self,
        *,
        id: str,
        user_id: str,
        token_hash: str,
        expires_at: str,
    ) -> Session:
        now = _now()
        self._conn.execute(
            """
            INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (id, user_id, token_hash, expires_at, now),
        )
        self._conn.commit()
        return Session(
            id=id,
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            created_at=now,
        )

    @_locked
    def get_session_by_token_hash(self, token_hash: str) -> Session | None:
        row = self._conn.execute(
            "SELECT * FROM sessions WHERE token_hash = ?",
            (token_hash,),
        ).fetchone()
        if row is None:
            return None
        return Session(
            id=row["id"],
            user_id=row["user_id"],
            token_hash=row["token_hash"],
            expires_at=row["expires_at"],
            created_at=row["created_at"],
        )

    @_locked
    def delete_session_by_token_hash(self, token_hash: str) -> None:
        self._conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        self._conn.commit()

    def _existing_vec_dimensions(self) -> int | None:
        row = self._conn.execute("SELECT embedding_dimensions FROM collections LIMIT 1").fetchone()
        if row is None:
            return None
        return int(row["embedding_dimensions"])
