from pathlib import Path

from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.generate.citations import REFUSAL_TEXT
from dossier.generate.fake_llm import FakeLlm
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.service import IngestService
from dossier.orchestrator import brief
from dossier.ports.repository import ChatMessage


def _ready(tmp_path: Path) -> tuple[SqliteRepository, FakeEmbeddings]:
    embeddings = FakeEmbeddings(model_name="fake", dimensions=8)
    repo = SqliteRepository(connect(tmp_path / "t.db"))
    repo.create_collection(
        id="default",
        name="default",
        embedding_model="fake",
        embedding_dimensions=8,
    )
    service = IngestService(repo, embeddings, files_dir=tmp_path / "files")
    service.ingest_bytes(
        "default",
        "label.md",
        "text/markdown",
        b"# Dose\n\nThe recommended dose is 10 mg once daily.",
    )
    return repo, embeddings


def test_real_cite_is_kept(tmp_path: Path) -> None:
    repo, embeddings = _ready(tmp_path)
    chunk_id = repo.search_vector("default", embeddings.embed_texts(["10 mg"])[0], k=1)[0].id
    llm = FakeLlm(claimed_chunk_ids=[chunk_id])
    result = brief(
        repo=repo,
        embeddings=embeddings,
        llm=llm,
        collection_id="default",
        question="What is the recommended dose?",
    )
    assert result.refused is False
    assert result.citations[0].chunk_id == chunk_id


def test_bogus_cite_is_refused(tmp_path: Path) -> None:
    repo, embeddings = _ready(tmp_path)
    llm = FakeLlm(text="It is 99 mg.", claimed_chunk_ids=["not-real"])
    result = brief(
        repo=repo,
        embeddings=embeddings,
        llm=llm,
        collection_id="default",
        question="What is the recommended dose?",
    )
    assert result.refused is True
    assert result.citations == []
    assert result.text == REFUSAL_TEXT


def test_empty_retrieve_skips_llm(tmp_path: Path) -> None:
    embeddings = FakeEmbeddings(dimensions=8)
    repo = SqliteRepository(connect(tmp_path / "empty.db"))
    repo.create_collection(
        id="empty", name="empty", embedding_model="fake", embedding_dimensions=8
    )
    llm = FakeLlm()
    result = brief(
        repo=repo,
        embeddings=embeddings,
        llm=llm,
        collection_id="empty",
        question="Anything?",
    )
    assert llm.calls == 0
    assert result.refused is True


def test_follow_up_uses_rewritten_query(tmp_path: Path) -> None:
    repo, embeddings = _ready(tmp_path)
    chunk_id = repo.search_vector("default", embeddings.embed_texts(["10 mg"])[0], k=1)[0].id
    llm = FakeLlm(
        claimed_chunk_ids=[chunk_id],
        rewrite_text="What is the recommended dose and the contraindication?",
    )
    result = brief(
        repo=repo,
        embeddings=embeddings,
        llm=llm,
        collection_id="default",
        question="the second one",
        history=[
            ChatMessage(role="user", content="compare dose and contraindication"),
            ChatMessage(role="assistant", content="Both are on the label."),
        ],
    )
    assert result.rewritten_query == "What is the recommended dose and the contraindication?"
    packed = llm.last_messages[-1].content
    assert "the second one" not in packed
    assert "recommended dose" in packed


def test_history_truncated_to_four(tmp_path: Path) -> None:
    repo, embeddings = _ready(tmp_path)
    chunk_id = repo.search_vector("default", embeddings.embed_texts(["dose"])[0], k=1)[0].id
    llm = FakeLlm(claimed_chunk_ids=[chunk_id])
    history = [ChatMessage(role="user", content=f"turn {i}") for i in range(6)]
    brief(
        repo=repo,
        embeddings=embeddings,
        llm=llm,
        collection_id="default",
        question="Dose?",
        history=history,
    )
    user_turns = [message for message in llm.last_messages if not message.content.startswith("<source")]
    # last 4 history + the new packed question
    assert len(llm.last_messages) == 5
    assert user_turns[0].content == "turn 2"


def test_follow_up_history_strips_cite_marks(tmp_path: Path) -> None:
    repo, embeddings = _ready(tmp_path)
    chunk_id = repo.search_vector("default", embeddings.embed_texts(["10 mg"])[0], k=1)[0].id
    llm = FakeLlm(claimed_chunk_ids=[chunk_id])
    brief(
        repo=repo,
        embeddings=embeddings,
        llm=llm,
        collection_id="default",
        question="what is in it?",
        history=[
            ChatMessage(role="user", content="Is there any X-ray related document?"),
            ChatMessage(
                role="assistant",
                content="Yes. A baseline film was clear 【90ddda3d-71da-4e33-a46d-f6f89583ab1a】.",
            ),
        ],
    )
    assistant = next(message for message in llm.last_messages if message.role == "assistant")
    assert "90ddda3d" not in assistant.content
    assert "baseline film was clear" in assistant.content
