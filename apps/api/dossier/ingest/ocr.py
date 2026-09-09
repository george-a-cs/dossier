from __future__ import annotations

import json
from io import BytesIO
from typing import Any

import structlog
from PIL import Image, ImageOps

from dossier.ingest.errors import VisionError
from dossier.ports.vision import ImageAnalysis, OcrBox, as_analysis

log = structlog.get_logger("dossier.ocr")
_layout_ocr: RapidOcrAnalyzer | None = None


def layout_analyzer() -> RapidOcrAnalyzer:
    global _layout_ocr
    if _layout_ocr is None:
        _layout_ocr = RapidOcrAnalyzer()
    return _layout_ocr


class RapidOcrAnalyzer:
    """Local printed-text fallback when the vision host rejects images."""

    def __init__(self) -> None:
        self._engine = None

    def analyze(self, *, filename: str, mime: str, data: bytes) -> ImageAnalysis:
        del filename, mime
        image = Image.open(BytesIO(data))
        image = ImageOps.exif_transpose(image) or image
        if image.mode != "RGB":
            image = image.convert("RGB")
        engine = self._load()
        try:
            raw = engine(_as_array(image))
        except VisionError:
            raise
        except Exception as exc:
            raise VisionError(f"local OCR failed: {exc}") from exc
        boxes = tuple(_boxes_from_ocr(raw, _ocr_size(raw, image.size)))
        text = "\n".join(box.text for box in boxes)
        if not text:
            raise VisionError("local OCR found no text")
        return ImageAnalysis(text=f"# Image text\n\n{text}", boxes=boxes)

    def _load(self):
        if self._engine is None:
            self._engine = _load_rapidocr()
        return self._engine


class FallbackImageAnalyzer:
    def __init__(self, primary, fallback) -> None:
        self._primary = primary
        self._fallback = fallback

    def analyze(self, *, filename: str, mime: str, data: bytes) -> ImageAnalysis:
        primary: ImageAnalysis | None = None
        try:
            primary = as_analysis(
                self._primary.analyze(filename=filename, mime=mime, data=data)
            )
            if primary.text.strip() and primary.boxes:
                return primary
        except VisionError as exc:
            log.warning("vision_primary_failed", detail=str(exc)[:300])
        log.info("vision_ocr_fallback", filename=filename)
        try:
            fallback = as_analysis(
                self._fallback.analyze(filename=filename, mime=mime, data=data)
            )
        except VisionError as exc:
            log.warning("vision_ocr_fallback_failed", detail=str(exc)[:300])
            if primary and primary.text.strip():
                return primary
            raise
        if primary and primary.text.strip():
            return ImageAnalysis(text=primary.text, boxes=fallback.boxes)
        return fallback


def serialize_boxes(boxes: tuple[OcrBox, ...] | list[OcrBox]) -> str:
    return json.dumps([box.to_json() for box in boxes])


def parse_boxes(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []
    out: list[dict] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            box = {
                "text": str(item["text"]),
                "x": float(item["x"]),
                "y": float(item["y"]),
                "w": float(item["w"]),
                "h": float(item["h"]),
            }
        except (KeyError, TypeError, ValueError):
            continue
        if box["w"] > 0 and box["h"] > 0:
            out.append(box)
    return out


def _as_array(image: Image.Image):
    import numpy as np

    return np.asarray(image)


def _load_rapidocr():
    try:
        from rapidocr import RapidOCR
    except ImportError:
        try:
            from rapidocr_onnxruntime import RapidOCR
        except ImportError as exc:
            raise VisionError("local OCR is not installed") from exc
    return RapidOCR()


def _boxes_from_ocr(raw: Any, size: tuple[int, int]) -> list[OcrBox]:
    width, height = size
    if width < 1 or height < 1:
        return []
    boxes: list[OcrBox] = []
    for poly, text in _items_from_ocr(raw):
        word = str(text).strip()
        if not word:
            continue
        rect = _norm_rect(poly, width, height)
        if rect is None:
            continue
        boxes.append(OcrBox(text=word, **rect))
    return boxes


def _ocr_size(raw: Any, fallback: tuple[int, int]) -> tuple[int, int]:
    result = raw[0] if isinstance(raw, tuple) else raw
    img = getattr(result, "img", None)
    shape = getattr(img, "shape", None)
    if shape is not None and len(shape) >= 2:
        height, width = int(shape[0]), int(shape[1])
        if width > 0 and height > 0:
            return width, height
    return fallback


def _items_from_ocr(raw: Any) -> list[tuple[Any, str]]:
    result = raw[0] if isinstance(raw, tuple) else raw
    boxes = getattr(result, "boxes", None)
    txts = getattr(result, "txts", None)
    if boxes is not None and txts is not None:
        return list(zip(boxes, txts, strict=False))
    if not result:
        return []
    items: list[tuple[Any, str]] = []
    for item in result:
        if isinstance(item, (list, tuple)) and len(item) > 1:
            items.append((item[0], str(item[1])))
    return items


def _norm_rect(poly: Any, width: int, height: int) -> dict[str, float] | None:
    points: list[tuple[float, float]] = []
    if hasattr(poly, "tolist"):
        poly = poly.tolist()
    if not isinstance(poly, (list, tuple)):
        return None
    for point in poly:
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            points.append((float(point[0]), float(point[1])))
    if len(points) < 2:
        return None
    xs = [x for x, _ in points]
    ys = [y for _, y in points]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    pad_x = max((x1 - x0) * 0.03, 1.0)
    pad_y = max((y1 - y0) * 0.06, 1.0)
    x0 = max(0.0, x0 - pad_x)
    y0 = max(0.0, y0 - pad_y)
    x1 = min(float(width), x1 + pad_x)
    y1 = min(float(height), y1 + pad_y)
    w = (x1 - x0) / width
    h = (y1 - y0) / height
    if w <= 0 or h <= 0:
        return None
    return {"x": x0 / width, "y": y0 / height, "w": w, "h": h}


def _text_from_ocr(raw: Any) -> str:
    return "\n".join(text for _, text in _items_from_ocr(raw) if str(text).strip())
