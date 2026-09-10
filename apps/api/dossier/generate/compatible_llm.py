from __future__ import annotations

import json
from collections.abc import Iterator

import httpx

from dossier.generate.citations import claimed_ids_from_answer
from dossier.ports.llm import LlmEvent, LlmUsage
from dossier.ports.repository import ChatMessage


class CompatibleLlm:
    """OpenAI-compatible chat.completions. Host is env `LLM_BASE_URL`."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model_name: str,
        timeout: float = 120.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model_name = model_name
        self._timeout = timeout

    def stream_answer(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
    ) -> Iterator[LlmEvent]:
        payload = {
            "model": self.model_name,
            "temperature": 0.2,
            "stream": True,
            "messages": [{"role": "system", "content": system}]
            + [{"role": message.role, "content": message.content} for message in messages],
        }
        assembled: list[str] = []
        with httpx.stream(
            "POST",
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=payload,
            timeout=self._timeout,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    body = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = body.get("choices", [{}])[0].get("delta", {}).get("content")
                if delta:
                    assembled.append(delta)
                    yield LlmEvent(token=delta)
        raw = "".join(assembled)
        text, claimed = _split_citations(raw)
        yield LlmEvent(
            text=text,
            claimed_chunk_ids=claimed,
            usage=LlmUsage(tokens_in=0, tokens_out=len(raw.split())),
        )


def _split_citations(raw: str) -> tuple[str, list[str]]:
    return claimed_ids_from_answer(raw)
