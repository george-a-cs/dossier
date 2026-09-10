from __future__ import annotations

import json
import re
from dataclasses import dataclass

REFUSAL_TEXT = "Not in this dossier."

_INLINE_CITE = re.compile(r"【\s*([^】]+?)\s*】")
_CHUNK_JSON = re.compile(r"\{[^{}]*\"chunk_ids\"[^{}]*\}", re.DOTALL)
_TRAILING_FENCE = re.compile(r"```(?:json)?\s*$")


@dataclass(frozen=True)
class VerifyResult:
    kept: list[str]
    refused: bool


def claimed_ids_from_answer(raw: str) -> tuple[str, list[str]]:
    """Display text plus chunk ids from trailing JSON and inline 【id】 marks."""
    text = raw.strip()
    ids: list[str] = []
    seen: set[str] = set()

    def add(item: str) -> None:
        chunk_id = item.strip().strip("'\"")
        if chunk_id and chunk_id not in seen:
            seen.add(chunk_id)
            ids.append(chunk_id)

    for match in _CHUNK_JSON.finditer(text):
        try:
            payload = json.loads(match.group(0))
        except json.JSONDecodeError:
            continue
        for item in payload.get("chunk_ids") or []:
            add(str(item))

    for match in _INLINE_CITE.finditer(text):
        add(match.group(1))

    display = text
    matches = list(_CHUNK_JSON.finditer(text))
    if matches:
        display = _TRAILING_FENCE.sub("", text[: matches[-1].start()].rstrip()).rstrip()

    return display, ids


def verify_citations(claimed: list[str], retrieved: set[str]) -> VerifyResult:
    kept: list[str] = []
    seen: set[str] = set()
    for chunk_id in claimed:
        if chunk_id in retrieved and chunk_id not in seen:
            kept.append(chunk_id)
            seen.add(chunk_id)
    return VerifyResult(kept=kept, refused=len(kept) == 0)


def apply_refuse_policy(answer: str, verify: VerifyResult) -> tuple[str, bool]:
    """A non-refusal answer with zero kept cites becomes a refusal."""
    if verify.refused:
        return REFUSAL_TEXT, True
    return answer, False
