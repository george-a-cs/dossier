from __future__ import annotations

import uuid
from dataclasses import replace
from pathlib import Path
from typing import Any

from dossier.ingest.chunking import chunk
from dossier.ingest.errors import (
    DecodeError,
    ModelMismatchError,
    TooLargeError,
    UnreadableImageError,
    UnreadablePdfError,
    UnsupportedTypeError,
    VisionError,
)
from dossier.ingest.fake_vision import PassthroughImageAnalyzer
from dossier.ingest.images import IMAGE_MIMES, IMAGE_SUFFIXES, fallback_image_text, is_image
from dossier.ingest.ocr import serialize_boxes
from dossier.ingest.parsing import parse, parsed_image
from dossier.ports.embeddings import Embeddings
from dossier.ports.repository import Chunk, ChunkWithEmbedding, Document, Repository
from dossier.ports.vision import ImageAnalyzer, as_analysis

_KEEP = object()
MAX_BYTES = 10 * 1024 * 1024
ALLOWED_MIMES = {
    "application/pdf",
    "application/x-pdf",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "text/csv",
    "application/csv",
    "text/comma-separated-values",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroenabled.12",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.binary.macroenabled.12",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-word.document.macroenabled.12",
    "application/msword",
    "application/vnd.ms-word",
    *IMAGE_MIMES,
}


class IngestService:
    def __init__(
        self,
        repo: Repository,
        embeddings: Embeddings,
        files_dir: Path,
        seed_dir: Path | None = None,
        image_analyzer: ImageAnalyzer | None = None,
    ) -> None:
        self._repo = repo
        self._embeddings = embeddings
        self._files_dir = files_dir
        self._seed_dir = seed_dir
        self._images = image_analyzer or PassthroughImageAnalyzer()

    def ingest_bytes(
        self,
        collection_id: str,
        filename: str,
        mime: str,
        data: bytes,
        *,
        document_id: str | None = None,
        category: str | None = None,
        notes: str | None = None,
    ) -> Document:
        collection = self._repo.get_collection(collection_id)
        if collection is None:
            raise KeyError(collection_id)
        if collection.embedding_model != self._embeddings.model_name:
            raise ModelMismatchError(
                f"collection uses {collection.embedding_model}, ingest is {self._embeddings.model_name}"
            )
        if mime.split(";")[0].strip().lower() not in ALLOWED_MIMES and not _allowed_filename(filename):
            raise UnsupportedTypeError(mime)
        if len(data) > MAX_BYTES:
            raise TooLargeError(f"file exceeds {MAX_BYTES} bytes")

        document_id = document_id or str(uuid.uuid4())
        source_path = self._write_original(document_id, filename, data)
        document = Document(
            id=document_id,
            collection_id=collection_id,
            filename=filename,
            mime=mime,
            byte_size=len(data),
            status="parsing",
            error_code=None,
            page_count=None,
            chunk_count=0,
            source_path=str(source_path),
            category=clean_meta(category, 40),
            notes=clean_meta(notes, 280),
        )
        self._repo.upsert_document(document)

        try:
            parsed, vision_failed, ocr_layout = self._parse(filename, mime, data)
            if parsed.mime != document.mime:
                document = replace(document, mime=parsed.mime)
            if vision_failed:
                document = replace(document, error_code="vision_failed")
            if ocr_layout is not None:
                document = replace(document, ocr_layout=ocr_layout)
            document = self._with_status(document, "chunking", page_count=len(parsed.pages))
            self._repo.upsert_document(document)
            drafts = chunk(parsed, document_id=document_id, filename=filename)
            document = self._with_status(document, "embedding")
            self._repo.upsert_document(document)
            vectors = self._embeddings.embed_texts([draft.text for draft in drafts])
            items = [
                ChunkWithEmbedding(
                    chunk=Chunk(
                        id=str(uuid.uuid4()),
                        document_id=document_id,
                        collection_id=collection_id,
                        chunk_index=draft.chunk_index,
                        text=draft.text,
                        filename=filename,
                        page_start=draft.page_start,
                        page_end=draft.page_end,
                        section_title=draft.section_title,
                    ),
                    embedding=vector,
                )
                for draft, vector in zip(drafts, vectors, strict=True)
            ]
            self._repo.replace_chunks(document_id, items)
            document = self._with_status(document, "ready", chunk_count=len(items))
            return self._repo.upsert_document(document)
        except UnreadablePdfError:
            return self._fail(document, "unreadable_pdf")
        except UnreadableImageError:
            return self._fail(document, "unreadable_image")
        except DecodeError:
            return self._fail(document, "invalid_encoding")
        except UnsupportedTypeError:
            return self._fail(document, "unsupported_type")

    def _parse(self, filename: str, mime: str, data: bytes):
        if is_image(filename, mime):
            try:
                analysis = as_analysis(
                    self._images.analyze(filename=filename, mime=mime, data=data)
                )
            except VisionError:
                analysis = as_analysis("")
            text = analysis.text
            failed = not (text or "").strip()
            if failed:
                text = fallback_image_text(filename)
            layout = serialize_boxes(analysis.boxes) if analysis.boxes else None
            return parsed_image(filename, mime, data, text), failed, layout
        return parse(filename, mime, data), False, None

    def ingest_seed(self, collection_id: str, *, skip_existing: bool = False) -> list[Document]:
        if self._seed_dir is None:
            raise FileNotFoundError("seed directory is not configured")
        results: list[Document] = []
        for path in sorted(self._seed_dir.glob("*")):
            if path.suffix not in {".md", ".txt", ".pdf"}:
                continue
            existing = [
                doc
                for doc in self._repo.list_documents(collection_id)
                if doc.filename == path.name
            ]
            if existing and skip_existing:
                results.append(existing[0])
                continue
            document_id = existing[0].id if existing else None
            seed_category, seed_notes = _seed_meta(path.name)
            if existing:
                seed_category = existing[0].category or seed_category
                seed_notes = existing[0].notes or seed_notes
            mime = {
                ".md": "text/markdown",
                ".txt": "text/plain",
                ".pdf": "application/pdf",
            }[path.suffix]
            results.append(
                self.ingest_bytes(
                    collection_id,
                    path.name,
                    mime,
                    path.read_bytes(),
                    document_id=document_id,
                    category=seed_category,
                    notes=seed_notes,
                )
            )
        return results

    def _write_original(self, document_id: str, filename: str, data: bytes) -> Path:
        directory = self._files_dir / document_id
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / Path(filename).name
        path.write_bytes(data)
        return path

    def _fail(self, document: Document, error_code: str) -> Document:
        failed = self._with_status(document, "failed", error_code=error_code)
        return self._repo.upsert_document(failed)

    def _with_status(
        self,
        document: Document,
        status: str,
        *,
        error_code: Any = _KEEP,
        page_count: int | None = None,
        chunk_count: int | None = None,
    ) -> Document:
        return replace(
            document,
            status=status,
            error_code=document.error_code if error_code is _KEEP else error_code,
            page_count=document.page_count if page_count is None else page_count,
            chunk_count=document.chunk_count if chunk_count is None else chunk_count,
        )


def clean_meta(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.split()).strip()
    if not cleaned:
        return None
    return cleaned[:max_len]


def _seed_meta(filename: str) -> tuple[str | None, str | None]:
    lower = filename.lower()
    if "label" in lower:
        return "Label", "Product label excerpt"
    if "sop" in lower:
        return "SOP", "Standard operating procedure"
    if "guidance" in lower:
        return "Guidance", "Briefing guidance"
    return None, None


def _allowed_filename(filename: str) -> bool:
    return Path(filename).suffix.lower() in {
        ".pdf",
        ".md",
        ".markdown",
        ".txt",
        ".csv",
        ".xlsx",
        ".xlsm",
        ".xls",
        ".docx",
        ".docm",
        ".doc",
        *IMAGE_SUFFIXES,
    }
