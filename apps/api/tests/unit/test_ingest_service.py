from pathlib import Path

import pytest
from pypdf import PdfWriter

from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.ingest.errors import ModelMismatchError, TooLargeError
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.service import MAX_BYTES, IngestService


def _service(tmp_path: Path, embeddings: FakeEmbeddings | None = None) -> IngestService:
    embeddings = embeddings or FakeEmbeddings(model_name="fake", dimensions=8)
    repo = SqliteRepository(connect(tmp_path / "test.db"))
    repo.create_collection(
        id="default",
        name="default",
        embedding_model=embeddings.model_name,
        embedding_dimensions=embeddings.dimensions,
    )
    return IngestService(repo, embeddings, files_dir=tmp_path / "files", seed_dir=None)


def test_markdown_ingest_ready_and_retrievable(tmp_path: Path) -> None:
    service = _service(tmp_path)
    document = service.ingest_bytes(
        "default",
        "label.md",
        "text/markdown",
        b"# Dose\n\nThe recommended dose is 10 mg once daily.",
    )
    assert document.status == "ready"
    assert document.chunk_count > 0
    assert document.category is None
    assert document.notes is None
    hits = service._repo.search_vector(
        "default",
        service._embeddings.embed_texts(["recommended dose 10 mg"])[0],
        k=3,
    )
    assert hits
    assert "10 mg" in hits[0].text


def test_ingest_keeps_category_and_notes(tmp_path: Path) -> None:
    service = _service(tmp_path)
    labelled = service.ingest_bytes(
        "default",
        "sop.md",
        "text/markdown",
        b"# SOP\n\nRetrieve candidate passages first.",
        category=" SOP ",
        notes="  Ground every brief.  ",
    )
    assert labelled.status == "ready"
    assert labelled.category == "SOP"
    assert labelled.notes == "Ground every brief."


def test_empty_pdf_fails_without_vectors(tmp_path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    path = tmp_path / "empty.pdf"
    writer.write(path)
    service = _service(tmp_path)
    document = service.ingest_bytes("default", "empty.pdf", "application/pdf", path.read_bytes())
    assert document.status == "failed"
    assert document.error_code == "unreadable_pdf"
    assert service._repo.search_vector("default", [0.1] * 8, k=3) == []


def test_oversize_rejected(tmp_path: Path) -> None:
    service = _service(tmp_path)
    with pytest.raises(TooLargeError):
        service.ingest_bytes("default", "big.txt", "text/plain", b"x" * (MAX_BYTES + 1))


def test_model_mismatch(tmp_path: Path) -> None:
    service = _service(tmp_path, FakeEmbeddings(model_name="fake", dimensions=8))
    other = IngestService(
        service._repo,
        FakeEmbeddings(model_name="other", dimensions=8),
        files_dir=tmp_path / "files",
    )
    with pytest.raises(ModelMismatchError):
        other.ingest_bytes("default", "a.md", "text/markdown", b"# A\n\nBody.")
