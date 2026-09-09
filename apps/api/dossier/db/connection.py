from __future__ import annotations

import sqlite3
from pathlib import Path

# sqlite-vec ships a loadable extension. Docker/venv must install the
# `sqlite-vec` Python package so sqlite_vec.load() can find the .so.
import sqlite_vec

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


class VecExtensionError(RuntimeError):
    pass


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA foreign_keys=ON")
    load_sqlite_vec(conn)
    apply_schema(conn)
    return conn


def load_sqlite_vec(conn: sqlite3.Connection) -> None:
    try:
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
    except Exception as exc:
        raise VecExtensionError(
            "sqlite-vec extension failed to load. Install the sqlite-vec package."
        ) from exc


def apply_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text())
    _ensure_document_meta_columns(conn)
    conn.commit()


def _ensure_document_meta_columns(conn: sqlite3.Connection) -> None:
    columns = {
        row[1] for row in conn.execute("PRAGMA table_info(documents)").fetchall()
    }
    if "category" not in columns:
        conn.execute("ALTER TABLE documents ADD COLUMN category TEXT")
    if "notes" not in columns:
        conn.execute("ALTER TABLE documents ADD COLUMN notes TEXT")
    if "ocr_layout" not in columns:
        conn.execute("ALTER TABLE documents ADD COLUMN ocr_layout TEXT")


def ensure_vec_table(conn: sqlite3.Connection, dimensions: int) -> None:
    dims = int(dimensions)
    if dims < 1:
        raise ValueError("embedding dimensions must be >= 1")
    existing = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='chunk_vec'"
    ).fetchone()
    if existing:
        return
    # Dimension is baked into vec0 DDL. First collection wins; later ones
    # must match (enforced in the repository).
    conn.execute(
        f"CREATE VIRTUAL TABLE chunk_vec USING vec0("
        f"chunk_id TEXT PRIMARY KEY, embedding float[{dims}])"
    )
    conn.commit()
