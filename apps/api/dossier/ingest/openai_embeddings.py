from __future__ import annotations

import time

import httpx


class CompatibleEmbeddings:
    """OpenAI-compatible embeddings. Host is env `EMBEDDING_BASE_URL` / `LLM_BASE_URL`."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model_name: str,
        dimensions: int | None = None,
        timeout: float = 60.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model_name = model_name
        self._dimensions = dimensions
        self._timeout = timeout

    @property
    def dimensions(self) -> int:
        if self._dimensions is None:
            raise RuntimeError("embedding dimensions unknown until the first embed_texts call")
        return self._dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        payload = self._post(texts)
        vectors = [item["embedding"] for item in sorted(payload["data"], key=lambda row: row["index"])]
        if self._dimensions is None and vectors:
            self._dimensions = len(vectors[0])
        return vectors

    def _post(self, texts: list[str]) -> dict:
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                response = httpx.post(
                    f"{self.base_url}/embeddings",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": self.model_name, "input": texts},
                    timeout=self._timeout,
                )
                if response.status_code == 429 and attempt == 0:
                    time.sleep(1)
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt == 0:
                    time.sleep(0.5)
                    continue
                raise
        raise last_error or RuntimeError("embeddings request failed")
