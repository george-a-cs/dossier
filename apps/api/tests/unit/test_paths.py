from pathlib import Path

from dossier.paths import seed_dir


def test_seed_dir_finds_repo_fixtures() -> None:
    found = seed_dir()
    assert found.is_dir()
    assert (found / "golden.json").is_file()


def test_seed_dir_does_not_indexerror_when_shallow(tmp_path: Path) -> None:
    found = seed_dir(start=tmp_path / "only" / "two")
    assert found == Path("/app/data/seed")
