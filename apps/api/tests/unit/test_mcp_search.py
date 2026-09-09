from pathlib import Path

from dossier.config import Settings
from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.service import IngestService
from dossier.mcp.server import search_corpus
from dossier.retrieve.hybrid import hybrid_search


def test_mcp_ids_match_hybrid(tmp_path: Path, monkeypatch) -> None:
    db = tmp_path / "mcp.db"
    monkeypatch.setenv("DATABASE_PATH", str(db))
    embeddings = FakeEmbeddings(model_name="fake", dimensions=8)
    repo = SqliteRepository(connect(db))
    repo.create_collection(
        id="default", name="D", embedding_model="fake", embedding_dimensions=8
    )
    IngestService(repo, embeddings, files_dir=tmp_path / "files").ingest_bytes(
        "default",
        "label.md",
        "text/markdown",
        b"# Dose\n\nThe recommended dose is 10 mg once daily.",
    )
    monkeypatch.setattr(
        "dossier.mcp.server.get_settings",
        lambda: Settings(database_path=db, embedding_model="", _env_file=None),
    )
    query = "recommended dose"
    hybrid_ids = [hit.id for hit in hybrid_search(repo, embeddings, "default", query)]
    tool_ids = [hit["id"] for hit in search_corpus("default", query)]
    assert tool_ids == hybrid_ids
    assert tool_ids
