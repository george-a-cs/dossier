from pathlib import Path

from fastapi.testclient import TestClient

from dossier.api.deps import get_repository
from dossier.generate.fake_llm import FakeLlm
from dossier.ingest.fake_embeddings import FakeEmbeddings
from tests.api.helpers import authenticate, make_client
from tests.api.test_brief import _client, _final_event, _seed


class _Request:
    def __init__(self, app) -> None:
        self.app = app


def test_briefs_are_scoped_to_the_signed_in_user(tmp_path: Path) -> None:
    client = _client(tmp_path)
    _seed(client)
    repo = get_repository(_Request(client.app))
    embeddings = client.app.state.embeddings
    chunk_id = repo.search_vector("default", embeddings.embed_texts(["10 mg"])[0], k=1)[0].id
    client.app.state.llm = FakeLlm(claimed_chunk_ids=[chunk_id])
    first = client.post(
        "/collections/default/brief",
        json={"question": "What is the recommended dose?"},
    )
    assert first.status_code == 200
    conversation_id = _final_event(first.text)["conversation_id"]
    follow = client.post(
        "/collections/default/brief",
        json={"question": "And the maximum?", "conversation_id": conversation_id},
    )
    assert follow.status_code == 200
    saved = client.get(f"/briefs/{conversation_id}").json()
    assert len(saved["turns"]) == 2
    assert saved["title"] == "What is the recommended dose?"

    assert client.post(
        "/users",
        json={"name": "Analyst", "email": "analyst@example.com", "password": "Member_Pass@1"},
    ).status_code == 201
    member = TestClient(client.app)
    member.app.state.embeddings = FakeEmbeddings(model_name="fake", dimensions=8)
    member.app.state.llm = FakeLlm()
    authenticate(member, email="analyst@example.com", password="Member_Pass@1")
    assert member.get("/briefs").json() == []
    assert member.get(f"/briefs/{conversation_id}").status_code == 404
    assert member.delete(f"/briefs/{conversation_id}").status_code == 404
    assert client.get("/briefs").json()[0]["id"] == conversation_id


def test_delete_brief_is_gone_after_reload(tmp_path: Path) -> None:
    client = _client(tmp_path)
    _seed(client)
    response = client.post(
        "/collections/default/brief",
        json={"question": "Is there any X-ray related document?"},
    )
    brief_id = _final_event(response.text)["conversation_id"]
    assert client.delete(f"/briefs/{brief_id}").status_code == 204
    assert client.get("/briefs").json() == []
    assert client.get(f"/briefs/{brief_id}").status_code == 404


def test_put_imports_a_brief_for_this_user(tmp_path: Path) -> None:
    client = make_client(tmp_path, auth=True, llm_api_key="")
    assert client.post("/collections", json={"id": "default", "name": "Default"}).status_code == 201
    imported = client.put(
        "/briefs/imported-1",
        json={
            "title": "Imported dose",
            "collection_id": "default",
            "turns": [
                {
                    "question": "What is the recommended dose?",
                    "answer": "10 mg once daily.",
                    "final": {
                        "text": "10 mg once daily.",
                        "citations": [],
                        "refused": False,
                        "retrieval_ids": [],
                        "conversation_id": "imported-1",
                        "stats": {
                            "embed_ms": 1,
                            "retrieve_ms": 1,
                            "llm_ms": 1,
                            "tokens_in": 1,
                            "tokens_out": 1,
                        },
                    },
                }
            ],
        },
    )
    assert imported.status_code == 200
    body = imported.json()
    assert body["id"] == "imported-1"
    assert body["title"] == "Imported dose"
    assert client.get("/briefs").json()[0]["id"] == "imported-1"


def test_orphan_conversations_backfill_to_admin(tmp_path: Path) -> None:
    client = make_client(tmp_path, auth=True, llm_api_key="")
    assert client.post("/collections", json={"id": "default", "name": "Default"}).status_code == 201
    repo = get_repository(_Request(client.app))
    repo.create_conversation(id="orphan-1", collection_id="default")
    repo.add_message(conversation_id="orphan-1", role="user", content="What is the recommended dose?")
    repo.add_message(conversation_id="orphan-1", role="assistant", content="10 mg once daily.")
    assert repo.backfill_orphan_briefs() == 1
    assert repo.backfill_orphan_briefs() == 0
    listed = client.get("/briefs")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == "orphan-1"
    assert listed.json()[0]["turns"][0]["question"] == "What is the recommended dose?"
