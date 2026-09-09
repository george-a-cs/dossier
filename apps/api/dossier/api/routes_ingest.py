from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from dossier.api.deps import get_embeddings, get_ingest_service, get_repository
from dossier.ingest.errors import (
    ModelMismatchError,
    TooLargeError,
    UnsupportedTypeError,
    VisionError,
)
from dossier.ingest.images import is_image
from dossier.ingest.ocr import layout_analyzer, parse_boxes, serialize_boxes
from dossier.ingest.service import IngestService, clean_meta
from dossier.ports.embeddings import Embeddings
from dossier.ports.repository import Document, Repository
from dossier.ports.vision import as_analysis

router = APIRouter()


class CreateCollectionBody(BaseModel):
    name: str = "default"
    id: str = "default"


class UpdateDocumentBody(BaseModel):
    category: str | None = None
    notes: str | None = None


def _document_json(document: Document) -> dict:
    return {
        "id": document.id,
        "collection_id": document.collection_id,
        "filename": document.filename,
        "mime": document.mime,
        "byte_size": document.byte_size,
        "status": document.status,
        "error_code": document.error_code,
        "page_count": document.page_count,
        "chunk_count": document.chunk_count,
        "created_at": document.created_at,
        "category": document.category,
        "notes": document.notes,
    }


@router.post("/collections", status_code=201)
def create_collection(
    body: CreateCollectionBody,
    repo: Repository = Depends(get_repository),
    embeddings: Embeddings = Depends(get_embeddings),
) -> dict:
    existing = repo.get_collection(body.id)
    if existing:
        return {
            "id": existing.id,
            "name": existing.name,
            "embedding_model": existing.embedding_model,
        }
    try:
        dimensions = embeddings.dimensions
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    created = repo.create_collection(
        id=body.id,
        name=body.name,
        embedding_model=embeddings.model_name,
        embedding_dimensions=dimensions,
    )
    return {
        "id": created.id,
        "name": created.name,
        "embedding_model": created.embedding_model,
    }


@router.post("/collections/{collection_id}/documents", status_code=201)
async def upload_document(
    collection_id: str,
    file: UploadFile = File(...),
    category: str | None = Form(None),
    notes: str | None = Form(None),
    service: IngestService = Depends(get_ingest_service),
) -> dict:
    data = await file.read()
    mime = file.content_type or "application/octet-stream"
    try:
        document = service.ingest_bytes(
            collection_id,
            file.filename or "upload",
            mime,
            data,
            category=category,
            notes=notes,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="collection not found") from exc
    except TooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except UnsupportedTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except ModelMismatchError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _document_json(document)


@router.post("/collections/{collection_id}/seed", status_code=201)
def seed_collection(
    collection_id: str,
    service: IngestService = Depends(get_ingest_service),
) -> list[dict]:
    try:
        documents = service.ingest_seed(collection_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="collection not found") from exc
    except ModelMismatchError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return [_document_json(document) for document in documents]


@router.get("/collections/{collection_id}/documents")
def list_documents(
    collection_id: str,
    repo: Repository = Depends(get_repository),
) -> list[dict]:
    if repo.get_collection(collection_id) is None:
        raise HTTPException(status_code=404, detail="collection not found")
    return [_document_json(document) for document in repo.list_documents(collection_id)]


@router.get("/documents/{document_id}")
def get_document(
    document_id: str,
    repo: Repository = Depends(get_repository),
) -> dict:
    document = repo.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    return _document_json(document)


@router.patch("/documents/{document_id}")
def update_document(
    document_id: str,
    body: UpdateDocumentBody,
    repo: Repository = Depends(get_repository),
) -> dict:
    updated = repo.update_document_meta(
        document_id,
        category=clean_meta(body.category, 40),
        notes=clean_meta(body.notes, 280),
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="document not found")
    return _document_json(updated)


@router.get("/documents/{document_id}/layout")
def get_document_layout(
    document_id: str,
    repo: Repository = Depends(get_repository),
) -> dict:
    document = repo.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    stored = parse_boxes(document.ocr_layout)
    if stored or document.ocr_layout == "[]":
        return {"boxes": stored}
    if not document.source_path or not is_image(document.filename, document.mime):
        return {"boxes": []}
    path = Path(document.source_path)
    if not path.is_file():
        return {"boxes": []}
    try:
        analysis = as_analysis(
            layout_analyzer().analyze(
                filename=document.filename,
                mime=document.mime,
                data=path.read_bytes(),
            )
        )
    except VisionError:
        repo.update_document_ocr_layout(document_id, "[]")
        return {"boxes": []}
    layout = serialize_boxes(analysis.boxes) if analysis.boxes else "[]"
    repo.update_document_ocr_layout(document_id, layout)
    return {"boxes": parse_boxes(layout)}


@router.get("/documents/{document_id}/file")
def get_document_file(
    document_id: str,
    repo: Repository = Depends(get_repository),
) -> FileResponse:
    document = repo.get_document(document_id)
    if document is None or not document.source_path:
        raise HTTPException(status_code=404, detail="document not found")
    path = Path(document.source_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(
        path,
        media_type=document.mime or "application/octet-stream",
        filename=document.filename,
        content_disposition_type="inline",
    )


@router.get("/documents/{document_id}/chunks")
def list_document_chunks(
    document_id: str,
    repo: Repository = Depends(get_repository),
) -> list[dict]:
    document = repo.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    return [
        {
            "id": chunk.id,
            "document_id": chunk.document_id,
            "text": chunk.text,
            "filename": chunk.filename,
            "page_start": chunk.page_start,
            "page_end": chunk.page_end,
            "section_title": chunk.section_title,
            "chunk_index": chunk.chunk_index,
        }
        for chunk in repo.list_chunks(document_id)
    ]


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    repo: Repository = Depends(get_repository),
) -> None:
    document = repo.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    repo.delete_document(document_id)
    if document.source_path:
        folder = Path(document.source_path).parent
        if folder.exists():
            shutil.rmtree(folder, ignore_errors=True)
