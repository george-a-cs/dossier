import json
from pathlib import Path

from fastapi.testclient import TestClient

from dossier.api.app import create_app
from dossier.api.deps import get_repository
from dossier.generate.citations import REFUSAL_TEXT
from dossier.generate.fake_llm import FakeLlm
from dossier.ingest.fake_embeddings import FakeEmbeddings
from tests.api.helpers import authenticate, make_settings


class _Request:
    def __init__(self, app) -> None:
        self.app = app


def _client(tmp_path: Path, llm: FakeLlm | None = None) -> TestClient:
    app = create_app(make_settings(tmp_path, llm_api_key=""))
    app.state.embeddings = FakeEmbeddings(model_name="fake", dimensions=8)
    app.state.llm = llm or FakeLlm()
    client = TestClient(app)
    authenticate(client)
    return client


def _seed(client: TestClient) -> None:
    assert client.post("/collections", json={"id": "default", "name": "Default"}).status_code == 201
    upload = client.post(
        "/collections/default/documents",
        files={"file": ("label.md", b"# Dose\n\nThe recommended dose is 10 mg once daily.", "text/markdown")},
    )
    assert upload.status_code == 201


def _final_event(body: str) -> dict:
    for block in body.split("\n\n"):
        if block.startswith("event: final"):
            line = next(part for part in block.split("\n") if part.startswith("data: "))
            return json.loads(line[6:])
    raise AssertionError(f"no final event in {body}")


def test_grounded_brief(tmp_path: Path) -> None:
    client = _client(tmp_path)
    _seed(client)
    repo = get_repository(_Request(client.app))
    embeddings = client.app.state.embeddings
    chunk_id = repo.search_vector("default", embeddings.embed_texts(["10 mg"])[0], k=1)[0].id
    client.app.state.llm = FakeLlm(claimed_chunk_ids=[chunk_id])
    response = client.post(
        "/collections/default/brief",
        json={"question": "What is the recommended dose?"},
    )
    assert response.status_code == 200
    final = _final_event(response.text)
    assert final["refused"] is False
    assert final["citations"][0]["chunk_id"] == chunk_id
    assert final["citations"][0]["document_id"]
    assert "cost_usd" in final["stats"]
    assert final["rewritten_query"] == "What is the recommended dose?"
    assert final["retrieval"]
    assert final["retrieval"][0]["chunk_id"] == chunk_id
    assert "rrf_rank" in final["retrieval"][0]
    chunk = client.get(f"/chunks/{chunk_id}")
    assert chunk.status_code == 200
    assert "10 mg" in chunk.json()["text"]
    stored = repo._conn.execute("SELECT COUNT(*) AS n FROM query_events").fetchone()
    assert stored["n"] == 1
    event = repo._conn.execute("SELECT citation_valid, refused, chunk_ids FROM query_events").fetchone()
    assert event["citation_valid"] == 1
    assert event["refused"] == 0
    assert "dose" not in event["chunk_ids"]  # ids only, no passage text
    events = client.get("/collections/default/events")
    assert events.status_code == 200
    assert events.json()[0]["refused"] is False
    assert events.json()[0]["citation_valid"] is True
    briefs = client.get("/briefs")
    assert briefs.status_code == 200
    assert len(briefs.json()) == 1
    saved = briefs.json()[0]
    assert saved["conversation_id"] == final["conversation_id"]
    assert saved["title"] == "What is the recommended dose?"
    assert saved["turns"][0]["question"] == "What is the recommended dose?"
    assert saved["turns"][0]["asked_at"]
    assert saved["turns"][0]["final"]["citations"][0]["chunk_id"] == chunk_id
    one = client.get(f"/briefs/{saved['id']}")
    assert one.status_code == 200
    assert one.json()["id"] == saved["id"]


def test_bogus_cite_refuses(tmp_path: Path) -> None:
    client = _client(tmp_path, FakeLlm(text="99 mg", claimed_chunk_ids=["nope"]))
    _seed(client)
    response = client.post(
        "/collections/default/brief",
        json={"question": "Is there any X-ray related document?"},
    )
    final = _final_event(response.text)
    assert final["refused"] is True
    assert final["citations"] == []
    assert final["text"] == REFUSAL_TEXT


def test_missing_collection(tmp_path: Path) -> None:
    client = _client(tmp_path)
    response = client.post("/collections/missing/brief", json={"question": "Hi"})
    assert response.status_code == 404
