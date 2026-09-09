from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi.testclient import TestClient

from dossier.api.app import create_app
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.fake_vision import FakeImageAnalyzer
from dossier.ports.vision import OcrBox
from tests.api.helpers import authenticate, make_settings
from tests.unit.test_images import PNG_1X1


def _client(tmp_path: Path) -> TestClient:
    app = create_app(make_settings(tmp_path))
    app.state.embeddings = FakeEmbeddings(model_name="fake", dimensions=8)
    client = TestClient(app)
    authenticate(client)
    return client


def test_upload_and_get_document(tmp_path: Path) -> None:
    client = _client(tmp_path)
    created = client.post("/collections", json={"id": "default", "name": "Default"})
    assert created.status_code == 201
    upload = client.post(
        "/collections/default/documents",
        files={"file": ("label.md", b"# Dose\n\nTake 10 mg daily.", "text/markdown")},
    )
    assert upload.status_code == 201
    body = upload.json()
    assert body["status"] == "ready"
    fetched = client.get(f"/documents/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["chunk_count"] > 0
    assert fetched.json()["byte_size"] > 0
    assert fetched.json()["created_at"]
    assert fetched.json()["category"] is None
    assert fetched.json()["notes"] is None
    chunks = client.get(f"/documents/{body['id']}/chunks")
    assert chunks.status_code == 200
    assert chunks.json()[0]["text"]
    missing = client.get("/documents/missing/chunks")
    assert missing.status_code == 404
    lan = {"Origin": "http://192.168.0.220:3000"}
    original = client.get(f"/documents/{body['id']}/file", headers=lan)
    assert original.status_code == 200
    assert b"Take 10 mg daily" in original.content
    assert original.headers.get("access-control-allow-origin") == "http://192.168.0.220:3000"
    missing_file = client.get("/documents/missing/file", headers=lan)
    assert missing_file.status_code == 404
    assert missing_file.headers.get("access-control-allow-origin") == "http://192.168.0.220:3000"
    deleted = client.delete(f"/documents/{body['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/documents/{body['id']}").status_code == 404
    assert client.delete("/documents/missing").status_code == 404


def test_auto_seeds_default_collection(tmp_path: Path) -> None:
    app = create_app(make_settings(tmp_path, auto_seed=True))
    client = TestClient(app)
    authenticate(client)
    listed = client.get("/collections/default/documents")
    assert listed.status_code == 200, listed.text
    names = {item["filename"] for item in listed.json()}
    assert {"label-excerpt.md", "guidance-excerpt.md", "sop-synthetic.md", "injection.md"} <= names
    assert all(item["status"] == "ready" for item in listed.json())
    again = create_app(make_settings(tmp_path, auto_seed=True))
    second = TestClient(again)
    authenticate(second)
    assert len(second.get("/collections/default/documents").json()) == len(listed.json())


def test_seed_collection(tmp_path: Path) -> None:
    client = _client(tmp_path)
    client.post("/collections", json={"id": "default", "name": "Default"})
    seeded = client.post("/collections/default/seed")
    assert seeded.status_code == 201, seeded.text
    names = {item["filename"] for item in seeded.json()}
    assert "label-excerpt.md" in names
    assert all(item["status"] == "ready" for item in seeded.json())
    by_name = {item["filename"]: item for item in seeded.json()}
    assert by_name["label-excerpt.md"]["category"] == "Label"
    assert by_name["sop-synthetic.md"]["category"] == "SOP"
    assert by_name["guidance-excerpt.md"]["category"] == "Guidance"


def test_concurrent_preview_reads(tmp_path: Path) -> None:
    client = _client(tmp_path)
    client.post("/collections", json={"id": "default", "name": "Default"})
    upload = client.post(
        "/collections/default/documents",
        files={"file": ("label.md", b"# Dose\n\nTake 10 mg daily.", "text/markdown")},
    )
    doc_id = upload.json()["id"]
    paths = [f"/documents/{doc_id}/file", f"/documents/{doc_id}/chunks"] * 16

    def hit(path: str) -> int:
        return client.get(path).status_code

    with ThreadPoolExecutor(8) as pool:
        codes = list(pool.map(hit, paths))
    assert codes
    assert all(code == 200 for code in codes)


def test_upload_and_patch_document_meta(tmp_path: Path) -> None:
    client = _client(tmp_path)
    client.post("/collections", json={"id": "default", "name": "Default"})
    upload = client.post(
        "/collections/default/documents",
        files={"file": ("label.md", b"# Dose\n\nTake 10 mg daily.", "text/markdown")},
        data={"category": "Label", "notes": "  Dose excerpt for briefing.  "},
    )
    assert upload.status_code == 201
    body = upload.json()
    assert body["category"] == "Label"
    assert body["notes"] == "Dose excerpt for briefing."
    patched = client.patch(
        f"/documents/{body['id']}",
        json={"category": "Guidance", "notes": "Moved after review."},
    )
    assert patched.status_code == 200
    assert patched.json()["category"] == "Guidance"
    assert patched.json()["notes"] == "Moved after review."
    listed = client.get("/collections/default/documents")
    assert listed.json()[0]["category"] == "Guidance"
    missing = client.patch("/documents/missing", json={"category": "SOP", "notes": ""})
    assert missing.status_code == 404


def test_upload_image_is_ready_and_previewable(tmp_path: Path) -> None:
    app = create_app(make_settings(tmp_path))
    app.state.embeddings = FakeEmbeddings(model_name="fake", dimensions=8)
    app.state.image_analyzer = FakeImageAnalyzer(
        "Visible text: 10 mg once daily.",
        boxes=[OcrBox(text="10 mg once daily", x=0.2, y=0.4, w=0.5, h=0.06)],
    )
    client = TestClient(app)
    authenticate(client)
    client.post("/collections", json={"id": "default", "name": "Default"})
    upload = client.post(
        "/collections/default/documents",
        files={"file": ("label.png", PNG_1X1, "image/png")},
        data={"category": "Label", "notes": "Dose screenshot"},
    )
    assert upload.status_code == 201
    body = upload.json()
    assert body["status"] == "ready"
    assert body["mime"] == "image/png"
    assert body["category"] == "Label"
    chunks = client.get(f"/documents/{body['id']}/chunks")
    assert "10 mg" in chunks.json()[0]["text"]
    preview = client.get(f"/documents/{body['id']}/file")
    assert preview.status_code == 200
    assert preview.content[:8] == b"\x89PNG\r\n\x1a\n"
    layout = client.get(f"/documents/{body['id']}/layout")
    assert layout.status_code == 200
    assert layout.json()["boxes"][0]["text"] == "10 mg once daily"
