from pathlib import Path

import httpx
import pytest

from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.ingest.compatible_vision import CompatibleVision, prepare_vision_jpeg
from dossier.ingest.errors import UnreadableImageError, VisionError
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.fake_vision import FakeImageAnalyzer
from dossier.ingest.images import image_mime, sniff_image
from dossier.ingest.ocr import FallbackImageAnalyzer, RapidOcrAnalyzer, _boxes_from_ocr, _ocr_size
from dossier.ingest.parsing import parsed_image
from dossier.ingest.service import IngestService
from dossier.ports.vision import ImageAnalysis, OcrBox

# 1x1 transparent PNG
PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


def _service(tmp_path: Path, analyzer: FakeImageAnalyzer | None = None) -> IngestService:
    embeddings = FakeEmbeddings(model_name="fake", dimensions=8)
    repo = SqliteRepository(connect(tmp_path / "test.db"))
    repo.create_collection(
        id="default",
        name="default",
        embedding_model=embeddings.model_name,
        embedding_dimensions=embeddings.dimensions,
    )
    return IngestService(
        repo,
        embeddings,
        files_dir=tmp_path / "files",
        image_analyzer=analyzer or FakeImageAnalyzer(),
    )


def test_sniff_png_and_reject_garbage() -> None:
    assert sniff_image(PNG_1X1) == "png"
    assert image_mime("shot.png", "image/png", PNG_1X1) == "image/png"
    with pytest.raises(UnreadableImageError):
        image_mime("shot.png", "image/png", b"not-an-image")


def test_parsed_image_is_one_page() -> None:
    parsed = parsed_image("label.png", "image/png", PNG_1X1, "Visible text: 10 mg once daily.")
    assert parsed.kind == "image"
    assert parsed.pages[0].text.startswith("Visible text")


def test_image_ingest_ready_and_retrievable(tmp_path: Path) -> None:
    service = _service(tmp_path)
    document = service.ingest_bytes(
        "default",
        "label.png",
        "image/png",
        PNG_1X1,
        notes="Dose screenshot",
    )
    assert document.status == "ready"
    assert document.mime == "image/png"
    assert document.chunk_count > 0
    assert document.notes == "Dose screenshot"
    assert document.error_code is None
    hits = service._repo.search_vector(
        "default",
        service._embeddings.embed_texts(["10 mg once daily"])[0],
        k=3,
    )
    assert hits
    assert "10 mg" in hits[0].text


def test_corrupt_image_fails_without_vectors(tmp_path: Path) -> None:
    service = _service(tmp_path)
    document = service.ingest_bytes("default", "bad.png", "image/png", b"nope")
    assert document.status == "failed"
    assert document.error_code == "unreadable_image"
    assert service._repo.search_vector("default", [0.1] * 8, k=3) == []


def test_vision_fallback_still_indexes(tmp_path: Path) -> None:
    service = _service(tmp_path, FakeImageAnalyzer(text=""))
    document = service.ingest_bytes("default", "chart.png", "image/png", PNG_1X1)
    assert document.status == "ready"
    chunks = service._repo.list_chunks(document.id)
    assert chunks
    assert "not extracted" in chunks[0].text
    assert document.error_code == "vision_failed"


def test_prepare_vision_jpeg_from_png() -> None:
    jpeg = prepare_vision_jpeg(PNG_1X1)
    assert jpeg.startswith(b"\xff\xd8\xff")


def test_compatible_vision_reads_message(monkeypatch) -> None:
    def fake_post(url, headers, json, timeout):
        del headers, timeout
        assert url.endswith("/chat/completions")
        assert json["model"] == "vision"
        assert json["max_tokens"] == 2048
        assert json["messages"][0]["content"][1]["type"] == "image_url"
        request = httpx.Request("POST", url)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "  Dose 10 mg  "}}]},
            request=request,
        )

    monkeypatch.setattr("dossier.ingest.compatible_vision.httpx.post", fake_post)
    text = CompatibleVision(
        base_url="https://example.test/v1",
        api_key="k",
        model_name="vision",
    ).analyze(filename="label.png", mime="image/png", data=PNG_1X1)
    assert text.text == "Dose 10 mg"


def test_compatible_vision_falls_back_to_native_chat(monkeypatch) -> None:
    calls: list[str] = []

    def fake_post(url, headers, json, timeout):
        del headers, timeout
        calls.append(url)
        request = httpx.Request("POST", url)
        if url.endswith("/api/chat"):
            assert json["messages"][0]["images"]
            return httpx.Response(
                200,
                json={"message": {"content": "John Alexander Smith"}},
                request=request,
            )
        return httpx.Response(500, text="openai vision failed", request=request)

    monkeypatch.setattr("dossier.ingest.compatible_vision.httpx.post", fake_post)
    text = CompatibleVision(
        base_url="https://example.test/v1",
        api_key="k",
        model_name="vision-docs-reasoning",
    ).analyze(filename="letter.png", mime="image/png", data=PNG_1X1)
    assert text.text == "John Alexander Smith"
    assert any(url.endswith("/api/chat") for url in calls)


def test_ocr_fallback_used_when_vision_fails() -> None:
    class Boom:
        def analyze(self, *, filename: str, mime: str, data: bytes) -> str:
            del filename, mime, data
            raise VisionError("image input is not supported")

    class Local:
        def analyze(self, *, filename: str, mime: str, data: bytes) -> ImageAnalysis:
            del mime, data
            return ImageAnalysis(
                text=f"# Image text\n\n{filename}",
                boxes=(OcrBox(text=filename, x=0.1, y=0.2, w=0.4, h=0.05),),
            )

    text = FallbackImageAnalyzer(Boom(), Local()).analyze(
        filename="letter.jpg",
        mime="image/jpeg",
        data=PNG_1X1,
    )
    assert "letter.jpg" in text.text
    assert text.boxes[0].text == "letter.jpg"


def test_ocr_size_prefers_engine_image() -> None:
    class Out:
        img = type("Arr", (), {"shape": (200, 100, 3)})()

    assert _ocr_size(Out(), (50, 50)) == (100, 200)


def test_ocr_boxes_from_result_shapes() -> None:
    boxes = _boxes_from_ocr(
        ([[[(10, 20), (90, 20), (90, 40), (10, 40)], "John Alexander Smith", 0.9]], 0.12),
        (100, 100),
    )
    assert boxes[0].text == "John Alexander Smith"
    assert 0 < boxes[0].w < 1
    assert 0 < boxes[0].h < 1


def test_rapidocr_uses_injected_engine() -> None:
    analyzer = RapidOcrAnalyzer()
    analyzer._engine = lambda _image: (
        [[[(0, 0), (10, 0), (10, 4), (0, 4)], "Dose 10 mg", 0.99]],
        0.01,
    )
    text = analyzer.analyze(filename="label.png", mime="image/png", data=PNG_1X1)
    assert "Dose 10 mg" in text.text
    assert text.boxes[0].text == "Dose 10 mg"


def test_image_ingest_stores_ocr_boxes(tmp_path: Path) -> None:
    service = _service(
        tmp_path,
        FakeImageAnalyzer(
            "Visible text: 10 mg once daily.",
            boxes=[OcrBox(text="10 mg once daily", x=0.2, y=0.4, w=0.5, h=0.06)],
        ),
    )
    document = service.ingest_bytes("default", "label.png", "image/png", PNG_1X1)
    assert document.ocr_layout
    assert "10 mg once daily" in document.ocr_layout


def test_compatible_vision_errors(monkeypatch) -> None:
    def fake_post(url, headers, json, timeout):
        del url, headers, json, timeout
        request = httpx.Request("POST", "https://example.test/v1/chat/completions")
        return httpx.Response(400, json={"error": "no vision"}, request=request)

    monkeypatch.setattr("dossier.ingest.compatible_vision.httpx.post", fake_post)
    with pytest.raises(VisionError):
        CompatibleVision(
            base_url="https://example.test/v1",
            api_key="k",
            model_name="vision",
        ).analyze(filename="label.png", mime="image/png", data=PNG_1X1)
