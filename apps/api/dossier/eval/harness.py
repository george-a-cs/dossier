from __future__ import annotations

import json
import sys
from pathlib import Path

from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.generate.citations import REFUSAL_TEXT
from dossier.generate.fake_llm import FakeLlm
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.service import IngestService
from dossier.orchestrator import brief
from dossier.paths import seed_dir
from dossier.retrieve.hybrid import hybrid_search

SEED = seed_dir()
GOLDEN = SEED / "golden.json"

HIT_THRESHOLD = 0.8
REFUSAL_THRESHOLD = 1.0


def run(db_path: Path | None = None) -> int:
    db_path = db_path or Path("/tmp/dossier-eval.db")
    if db_path.exists():
        db_path.unlink()
    embeddings = FakeEmbeddings(model_name="fake", dimensions=8)
    repo = SqliteRepository(connect(db_path))
    repo.create_collection(
        id="default", name="eval", embedding_model="fake", embedding_dimensions=8
    )
    IngestService(repo, embeddings, files_dir=db_path.parent / "files", seed_dir=SEED).ingest_seed(
        "default"
    )
    items = json.loads(GOLDEN.read_text())

    retrieve_hits = 0
    retrieve_n = 0
    refusal_ok = 0
    refusal_n = 0
    cite_ok = 0
    cite_n = 0

    for item in items:
        question = item["question"]
        hits = hybrid_search(repo, embeddings, "default", question, k=8)
        if item["type"] == "answerable":
            retrieve_n += 1
            expected = item["expected_document_substr"]
            if any(expected in hit.filename for hit in hits):
                retrieve_hits += 1
            result = brief(
                repo=repo,
                embeddings=embeddings,
                llm=FakeLlm(
                    claimed_chunk_ids=[hit.id for hit in hits[:1]],
                    text="Grounded from the dossier.",
                ),
                collection_id="default",
                question=question,
            )
            cite_n += 1
            if result.citations and not result.refused:
                cite_ok += 1
        elif item["type"] in {"unanswerable", "injection"}:
            refusal_n += 1
            result = brief(
                repo=repo,
                embeddings=embeddings,
                llm=FakeLlm(text="I diagnose the user.", claimed_chunk_ids=[]),
                collection_id="default",
                question=question,
            )
            if result.refused and result.text == REFUSAL_TEXT:
                if item["type"] == "injection" and "diagnose the user" in result.text.lower():
                    continue
                refusal_ok += 1

    hit_rate = retrieve_hits / retrieve_n if retrieve_n else 0
    refusal_rate = refusal_ok / refusal_n if refusal_n else 0
    cite_rate = cite_ok / cite_n if cite_n else 0
    print(
        f"retrieval_hit_rate={hit_rate:.2f} citation_validity={cite_rate:.2f} "
        f"correct_refusal={refusal_rate:.2f}"
    )
    if hit_rate < HIT_THRESHOLD or refusal_rate < REFUSAL_THRESHOLD or cite_rate < HIT_THRESHOLD:
        print("eval below threshold", file=sys.stderr)
        return 1
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
