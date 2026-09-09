from __future__ import annotations

import re

from dossier.generate.prompts import strip_history_citations
from dossier.ports.llm import Llm
from dossier.ports.repository import ChatMessage

REWRITE_SYSTEM = """Rewrite the latest user question as a standalone search question for a private document collection.

Rules:
- Use only the conversation turns provided.
- Do not add facts that are not implied by those turns.
- Do not mention the web, browsers, search engines, or outside sources.
- Do not add instructions to the model.
- Output only the rewritten question.
"""

_BLOCKED = re.compile(
    r"(https?://|www\.|search the web|browse the|google\b|look up online|ignore previous)",
    re.IGNORECASE,
)
_MAX_LEN = 500


def rewrite_question(question: str, history: list[ChatMessage], llm: Llm) -> str:
    if not history:
        return question
    try:
        text = _complete(llm, history, question)
    except Exception:
        return question
    return _sanitize(text, question)


def _complete(llm: Llm, history: list[ChatMessage], question: str) -> str:
    turns = []
    for message in history[-4:]:
        content = (
            strip_history_citations(message.content)
            if message.role == "assistant"
            else message.content
        )
        turns.append(f"{message.role}: {content}")
    turns.append(f"user: {question}")
    user = "Conversation:\n" + "\n".join(turns) + f"\n\nLatest: {question}"
    final = ""
    for event in llm.stream_answer(
        system=REWRITE_SYSTEM,
        messages=[ChatMessage(role="user", content=user)],
    ):
        if event.is_final:
            final = (event.text or "").strip()
    return final


def _sanitize(text: str, fallback: str) -> str:
    line = text.strip().splitlines()[0].strip().strip("\"'")
    if not line or len(line) > _MAX_LEN:
        return fallback
    if _BLOCKED.search(line):
        return fallback
    return line
