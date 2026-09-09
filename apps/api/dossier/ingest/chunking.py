from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import tiktoken

from dossier.ingest.parsing import ParsedDocument, ParsedPage

ENCODING_NAME = "cl100k_base"
TOKEN_BUDGET = 512
TOKEN_OVERLAP = 64

_HEADING = re.compile(r"^(#{1,6}\s+\S.*|[A-Z][A-Z0-9 /-]{3,})$")
_encoder = tiktoken.get_encoding(ENCODING_NAME)


@dataclass(frozen=True)
class ChunkDraft:
    chunk_index: int
    text: str
    page_start: int | None
    page_end: int | None
    section_title: str | None


def token_count(text: str) -> int:
    return len(_encoder.encode(text))


def chunk(
    parsed: ParsedDocument,
    *,
    document_id: str,
    filename: str,
    token_budget: int = TOKEN_BUDGET,
    overlap: int = TOKEN_OVERLAP,
) -> list[ChunkDraft]:
    del document_id  # reserved for callers; chunker is pure over one document
    default_title = Path(filename).stem
    blocks = _blocks(parsed.pages, default_title)
    packed = _pack(blocks, token_budget=token_budget, overlap=overlap)
    return packed


def _blocks(pages: list[ParsedPage], default_title: str) -> list[tuple[str, int, str]]:
    """Return (section_title, page_number, paragraph)."""
    section = default_title
    out: list[tuple[str, int, str]] = []
    for page in pages:
        for raw in re.split(r"\n\s*\n", page.text):
            line = raw.strip()
            if not line:
                continue
            if _is_heading(line):
                section = line.lstrip("#").strip()
                continue
            out.append((section, page.page_number, line))
    return out


def _is_heading(text: str) -> bool:
    first = text.splitlines()[0].strip()
    return bool(_HEADING.match(first)) and "\n" not in text.strip()


def _pack(
    blocks: list[tuple[str, int, str]],
    *,
    token_budget: int,
    overlap: int,
) -> list[ChunkDraft]:
    drafts: list[ChunkDraft] = []
    current: list[tuple[str, int, str]] = []
    current_tokens = 0

    def flush() -> None:
        nonlocal current, current_tokens
        if not current:
            return
        text = "\n\n".join(block[2] for block in current)
        drafts.append(
            ChunkDraft(
                chunk_index=len(drafts),
                text=text,
                page_start=current[0][1],
                page_end=current[-1][1],
                section_title=current[0][0],
            )
        )
        if overlap > 0 and drafts:
            overlap_text = _tail_tokens(text, overlap)
            if overlap_text:
                current = [(current[-1][0], current[-1][1], overlap_text)]
                current_tokens = token_count(overlap_text)
                return
        current = []
        current_tokens = 0

    for block in blocks:
        block_tokens = token_count(block[2])
        if current and current_tokens + block_tokens > token_budget:
            flush()
        if block_tokens > token_budget:
            for piece in _split_tokens(block[2], token_budget):
                if current and current_tokens + token_count(piece) > token_budget:
                    flush()
                current.append((block[0], block[1], piece))
                current_tokens += token_count(piece)
            continue
        current.append(block)
        current_tokens += block_tokens
    flush()
    return drafts


def _split_tokens(text: str, budget: int) -> list[str]:
    tokens = _encoder.encode(text)
    pieces: list[str] = []
    for start in range(0, len(tokens), budget):
        pieces.append(_encoder.decode(tokens[start : start + budget]))
    return [piece for piece in pieces if piece.strip()]


def _tail_tokens(text: str, n: int) -> str:
    tokens = _encoder.encode(text)
    if not tokens:
        return ""
    return _encoder.decode(tokens[-n:])
