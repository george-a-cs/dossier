from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class OcrBox:
    text: str
    x: float
    y: float
    w: float
    h: float

    def to_json(self) -> dict:
        return {
            "text": self.text,
            "x": round(self.x, 6),
            "y": round(self.y, 6),
            "w": round(self.w, 6),
            "h": round(self.h, 6),
        }


@dataclass(frozen=True)
class ImageAnalysis:
    text: str
    boxes: tuple[OcrBox, ...] = ()


def as_analysis(value: ImageAnalysis | str) -> ImageAnalysis:
    if isinstance(value, ImageAnalysis):
        return value
    return ImageAnalysis(text=value or "")


class ImageAnalyzer(Protocol):
    def analyze(self, *, filename: str, mime: str, data: bytes) -> ImageAnalysis | str: ...
