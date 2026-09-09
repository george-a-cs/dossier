from __future__ import annotations

from collections.abc import Iterator

from dossier.generate.rewrite import REWRITE_SYSTEM
from dossier.ports.llm import LlmEvent, LlmUsage
from dossier.ports.repository import ChatMessage


class FakeLlm:
    def __init__(
        self,
        *,
        model_name: str = "fake-llm",
        text: str = "The recommended dose is 10 mg.",
        claimed_chunk_ids: list[str] | None = None,
        rewrite_text: str | None = None,
    ) -> None:
        self.model_name = model_name
        self.text = text
        self.claimed_chunk_ids = claimed_chunk_ids or []
        self.rewrite_text = rewrite_text
        self.calls = 0
        self.last_messages: list[ChatMessage] = []

    def stream_answer(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
    ) -> Iterator[LlmEvent]:
        self.last_messages = list(messages)
        self.calls += 1
        body = self.text
        if system == REWRITE_SYSTEM:
            body = self.rewrite_text if self.rewrite_text is not None else _latest(messages)
        for piece in _split(body):
            yield LlmEvent(token=piece)
        yield LlmEvent(
            text=body,
            claimed_chunk_ids=[] if system == REWRITE_SYSTEM else list(self.claimed_chunk_ids),
            usage=LlmUsage(tokens_in=12, tokens_out=len(body.split())),
        )


def _latest(messages: list[ChatMessage]) -> str:
    if not messages:
        return ""
    content = messages[-1].content
    marker = "Latest: "
    if marker in content:
        return content.rsplit(marker, 1)[-1].strip()
    return content.strip()


def _split(text: str) -> list[str]:
    if not text:
        return []
    words = text.split(" ")
    return [word if index == 0 else f" {word}" for index, word in enumerate(words)]
