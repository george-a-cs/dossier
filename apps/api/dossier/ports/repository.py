from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Collection:
    id: str
    name: str
    embedding_model: str
    embedding_dimensions: int


@dataclass(frozen=True)
class Document:
    id: str
    collection_id: str
    filename: str
    mime: str
    byte_size: int
    status: str
    error_code: str | None
    page_count: int | None
    chunk_count: int
    source_path: str | None
    created_at: str | None = None
    category: str | None = None
    notes: str | None = None
    ocr_layout: str | None = None


@dataclass(frozen=True)
class Chunk:
    id: str
    document_id: str
    collection_id: str
    chunk_index: int
    text: str
    filename: str
    page_start: int | None
    page_end: int | None
    section_title: str | None


@dataclass(frozen=True)
class ChunkWithEmbedding:
    chunk: Chunk
    embedding: list[float]


@dataclass(frozen=True)
class RetrievedChunk:
    id: str
    document_id: str
    text: str
    score: float  # sqlite-vec distance; lower is closer
    filename: str
    page_start: int | None
    page_end: int | None
    section_title: str | None
    chunk_index: int


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class User:
    id: str
    name: str
    email: str
    role: str
    created_at: str
    updated_at: str
    password_hash: str = ""


@dataclass(frozen=True)
class Session:
    id: str
    user_id: str
    token_hash: str
    expires_at: str
    created_at: str


@dataclass(frozen=True)
class Brief:
    id: str
    user_id: str
    collection_id: str
    conversation_id: str
    title: str
    turns: list[dict]
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class QueryEvent:
    id: str
    request_id: str
    collection_id: str
    embed_ms: float
    retrieve_ms: float
    llm_ms: float
    tokens_in: int
    tokens_out: int
    cost_usd: float
    citation_valid: bool
    refused: bool
    created_at: str


class Repository(Protocol):
    def create_collection(
        self,
        *,
        id: str,
        name: str,
        embedding_model: str,
        embedding_dimensions: int,
    ) -> Collection: ...

    def get_collection(self, id: str) -> Collection | None: ...

    def upsert_document(self, document: Document) -> Document: ...

    def list_documents(self, collection_id: str) -> list[Document]: ...

    def get_document(self, id: str) -> Document | None: ...

    def update_document_meta(
        self,
        id: str,
        *,
        category: str | None,
        notes: str | None,
    ) -> Document | None: ...

    def update_document_ocr_layout(self, id: str, ocr_layout: str | None) -> Document | None: ...

    def delete_document(self, id: str) -> bool: ...

    def replace_chunks(self, document_id: str, chunks: list[ChunkWithEmbedding]) -> None: ...

    def get_chunk(self, id: str) -> Chunk | None: ...

    def list_chunks(self, document_id: str) -> list[Chunk]: ...

    def list_query_events(self, collection_id: str, limit: int = 50) -> list[QueryEvent]: ...

    def search_vector(
        self,
        collection_id: str,
        embedding: list[float],
        k: int,
    ) -> list[RetrievedChunk]: ...

    def search_fts(
        self,
        collection_id: str,
        query: str,
        k: int,
    ) -> list[RetrievedChunk]: ...

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
    ) -> None: ...

    def create_conversation(self, *, id: str, collection_id: str) -> None: ...

    def ensure_conversation(self, *, id: str, collection_id: str) -> None: ...

    def add_message(self, *, conversation_id: str, role: str, content: str) -> None: ...

    def replace_conversation_messages(
        self, *, conversation_id: str, messages: list[ChatMessage]
    ) -> None: ...

    def list_recent_messages(self, conversation_id: str, limit: int = 4) -> list[ChatMessage]: ...

    def get_brief(self, id: str) -> Brief | None: ...

    def list_briefs(self, user_id: str) -> list[Brief]: ...

    def upsert_brief(
        self,
        *,
        id: str,
        user_id: str,
        collection_id: str,
        conversation_id: str,
        title: str,
        turns: list[dict],
        created_at: str | None = None,
    ) -> Brief: ...

    def delete_brief(self, id: str, user_id: str) -> bool: ...

    def backfill_orphan_briefs(self) -> int: ...

    def create_user(
        self,
        *,
        id: str,
        name: str,
        email: str,
        password_hash: str,
        role: str,
    ) -> User: ...

    def get_user(self, id: str) -> User | None: ...

    def get_user_by_email(self, email: str) -> User | None: ...

    def list_users(self) -> list[User]: ...

    def update_user(
        self,
        id: str,
        *,
        name: str,
        email: str,
        password_hash: str | None = None,
    ) -> User | None: ...

    def create_session(
        self,
        *,
        id: str,
        user_id: str,
        token_hash: str,
        expires_at: str,
    ) -> Session: ...

    def get_session_by_token_hash(self, token_hash: str) -> Session | None: ...

    def delete_session_by_token_hash(self, token_hash: str) -> None: ...
