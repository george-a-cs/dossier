from __future__ import annotations

from dossier.ports.vision import ImageAnalysis, OcrBox


class FakeImageAnalyzer:
    def __init__(
        self,
        text: str = "Visible text: 10 mg once daily.",
        boxes: tuple[OcrBox, ...] | list[OcrBox] | None = None,
    ) -> None:
        self.text = text
        self.boxes = tuple(boxes or ())
        self.calls = 0
        self.last_filename: str | None = None

    def analyze(self, *, filename: str, mime: str, data: bytes) -> ImageAnalysis:
        del mime, data
        self.calls += 1
        self.last_filename = filename
        return ImageAnalysis(text=self.text, boxes=self.boxes)


class PassthroughImageAnalyzer:
    def analyze(self, *, filename: str, mime: str, data: bytes) -> ImageAnalysis:
        del filename, mime, data
        return ImageAnalysis(text="")
