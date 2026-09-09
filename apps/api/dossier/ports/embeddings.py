from __future__ import annotations

from typing import Protocol


class Embeddings(Protocol):
    model_name: str
    dimensions: int

    def embed_texts(self, texts: list[str]) -> list[list[float]]: ...
