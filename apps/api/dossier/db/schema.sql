CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dimensions INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    page_count INTEGER,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    source_path TEXT,
    created_at TEXT NOT NULL,
    category TEXT,
    notes TEXT,
    ocr_layout TEXT
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    collection_id TEXT NOT NULL REFERENCES collections(id),
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    filename TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    section_title TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    chunk_id UNINDEXED,
    collection_id UNINDEXED,
    text
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS query_events (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    embed_ms REAL,
    retrieve_ms REAL,
    llm_ms REAL,
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_usd REAL,
    chunk_ids TEXT,
    models TEXT,
    citation_valid INTEGER,
    refused INTEGER,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS briefs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    title TEXT NOT NULL,
    turns TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS briefs_user_updated
    ON briefs (user_id, updated_at DESC);
