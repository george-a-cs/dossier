from __future__ import annotations

from dataclasses import dataclass

import tiktoken

from dossier.ingest.chunking import ENCODING_NAME
from dossier.ports.repository import RetrievedChunk

DEFAULT_MAX_TOKENS = 3000
MAX_CHUNKS = 8

_encoder = tiktoken.get_encoding(ENCODING_NAME)


@dataclass(frozen=True)
class PackedContext:
    chunks: list[RetrievedChunk]
    ids: list[str]
    prompt: str


def pack(
    chunks: list[RetrievedChunk],
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> PackedContext:
    # Incoming order is already ranked (vector distance or hybrid RRF).
    ordered = list(chunks)[:MAX_CHUNKS]
    selected: list[RetrievedChunk] = []
    used = 0
    for chunk in ordered:
        cost = len(_encoder.encode(_source_block(chunk)))
        if selected and used + cost > max_tokens:
            break
        selected.append(chunk)
        used += cost
    prompt = "\n\n".join(_source_block(chunk) for chunk in selected)
    return PackedContext(chunks=selected, ids=[chunk.id for chunk in selected], prompt=prompt)


def _source_block(chunk: RetrievedChunk) -> str:
    page = chunk.page_start if chunk.page_start is not None else ""
    return (
        f'<source chunk_id="{chunk.id}" document="{chunk.filename}" page="{page}">\n'
        f"{chunk.text}\n"
        f"</source>"
    )
