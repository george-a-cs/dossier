from __future__ import annotations

from pathlib import Path

from dossier.ingest.errors import UnreadableImageError

IMAGE_MIMES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/x-png",
    "image/pjpeg",
}

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}

_MIME_BY_KIND = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "bmp": "image/bmp",
}


def is_image(filename: str, mime: str) -> bool:
    normalised = mime.split(";")[0].strip().lower()
    return normalised in IMAGE_MIMES or Path(filename).suffix.lower() in IMAGE_SUFFIXES


def sniff_image(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data.startswith(b"BM") and len(data) >= 14:
        return "bmp"
    return None


def image_mime(filename: str, mime: str, data: bytes) -> str:
    kind = sniff_image(data)
    if kind is None:
        raise UnreadableImageError("file is not a readable image")
    normalised = mime.split(";")[0].strip().lower()
    if normalised in IMAGE_MIMES:
        return "image/jpeg" if normalised in {"image/jpg", "image/pjpeg"} else normalised
    suffix = Path(filename).suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    return _MIME_BY_KIND[kind]


def fallback_image_text(filename: str) -> str:
    return (
        f"# Image: {filename}\n\n"
        "This image was stored in the dossier. Visible text was not extracted."
    )
