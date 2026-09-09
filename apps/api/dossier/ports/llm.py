from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol

from dossier.ports.repository import ChatMessage


@dataclass(frozen=True)
class LlmUsage:
    tokens_in: int
    tokens_out: int


@dataclass(frozen=True)
class LlmEvent:
    token: str | None = None
    text: str | None = None
    claimed_chunk_ids: list[str] | None = None
    usage: LlmUsage | None = None

    @property
    def is_final(self) -> bool:
        return self.text is not None


class Llm(Protocol):
    model_name: str

    def stream_answer(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
    ) -> Iterator[LlmEvent]: ...
