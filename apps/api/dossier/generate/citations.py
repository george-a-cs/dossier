from __future__ import annotations

from dataclasses import dataclass

REFUSAL_TEXT = "Not in this dossier."


@dataclass(frozen=True)
class VerifyResult:
    kept: list[str]
    refused: bool


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
