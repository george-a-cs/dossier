from pathlib import Path

_DOCKER_SEED = Path("/app/data/seed")


def seed_dir(*, start: Path | None = None) -> Path:
    """Find `data/seed` by walking up. Docker layout is shallower than the repo."""
    here = (start or Path(__file__)).resolve()
    if here.is_file():
        here = here.parent
    for parent in [here, *here.parents]:
        candidate = parent / "data" / "seed"
        if candidate.is_dir():
            return candidate
    return _DOCKER_SEED
