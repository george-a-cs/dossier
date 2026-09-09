from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import structlog
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from dossier.auth.service import ROLE_SUPER_ADMIN, bootstrap_admin, user_from_token
from dossier.config import Settings
from dossier.db.connection import connect
from dossier.db.sqlite_repo import SqliteRepository
from dossier.generate.compatible_llm import CompatibleLlm
from dossier.generate.fake_llm import FakeLlm
from dossier.ingest.compatible_vision import CompatibleVision
from dossier.ingest.fake_embeddings import FakeEmbeddings
from dossier.ingest.ocr import FallbackImageAnalyzer, RapidOcrAnalyzer
from dossier.ingest.openai_embeddings import CompatibleEmbeddings
from dossier.ingest.service import IngestService
from dossier.ports.embeddings import Embeddings
from dossier.ports.llm import Llm
from dossier.ports.repository import Repository, User
from dossier.ports.vision import ImageAnalyzer

_bearer = HTTPBearer(auto_error=False)
_log = structlog.get_logger("dossier.boot")
DEFAULT_COLLECTION_ID = "default"
SEED_DIR = Path(__file__).resolve().parents[4] / "data" / "seed"


@lru_cache
def _connection(database_path: str):
    return connect(Path(database_path))


@lru_cache
def _repository(database_path: str) -> SqliteRepository:
    return SqliteRepository(_connection(database_path))


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_repository(request: Request) -> Repository:
    settings = get_settings(request)
    return _repository(str(settings.database_path.resolve()))


def embeddings_from_settings(settings: Settings) -> Embeddings:
    if not settings.embedding_model:
        # Chat keys must not silently send a chat model to /embeddings.
        return FakeEmbeddings()
    return CompatibleEmbeddings(
        base_url=settings.resolved_embedding_base_url(),
        api_key=settings.resolved_embedding_api_key(),
        model_name=settings.embedding_model,
        dimensions=settings.embedding_dimensions,
    )


def get_embeddings(request: Request) -> Embeddings:
    settings = get_settings(request)
    if getattr(request.app.state, "embeddings", None) is not None:
        return request.app.state.embeddings
    embeddings = embeddings_from_settings(settings)
    request.app.state.embeddings = embeddings
    return embeddings


def get_llm(request: Request) -> Llm:
    settings = get_settings(request)
    if getattr(request.app.state, "llm", None) is not None:
        return request.app.state.llm
    if settings.llm_api_key:
        llm: Llm = CompatibleLlm(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model_name=settings.llm_model,
        )
    else:
        llm = FakeLlm()
    request.app.state.llm = llm
    return llm


def seed_bootstrap_admin(settings: Settings) -> None:
    bootstrap_admin(_repository(str(settings.database_path.resolve())), settings)


def _embedding_dimensions(embeddings: Embeddings) -> int:
    try:
        return embeddings.dimensions
    except RuntimeError:
        embeddings.embed_texts(["dimension probe"])
        return embeddings.dimensions


def seed_default_corpus(settings: Settings) -> None:
    if not settings.auto_seed:
        return
    try:
        repo = _repository(str(settings.database_path.resolve()))
        embeddings = embeddings_from_settings(settings)
        if repo.get_collection(DEFAULT_COLLECTION_ID) is None:
            repo.create_collection(
                id=DEFAULT_COLLECTION_ID,
                name="Default",
                embedding_model=embeddings.model_name,
                embedding_dimensions=_embedding_dimensions(embeddings),
            )
        IngestService(
            repo,
            embeddings,
            files_dir=settings.files_dir.resolve(),
            seed_dir=SEED_DIR,
        ).ingest_seed(DEFAULT_COLLECTION_ID, skip_existing=True)
    except Exception:
        _log.exception("auto_seed_failed")


def get_bearer_token(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return creds.credentials


def require_user(
    token: str = Depends(get_bearer_token),
    repo: Repository = Depends(get_repository),
) -> User:
    user = user_from_token(repo, token)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_super_admin(user: User = Depends(require_user)) -> User:
    if user.role != ROLE_SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super admin required")
    return user


def get_image_analyzer(request: Request) -> ImageAnalyzer:
    settings = get_settings(request)
    if getattr(request.app.state, "image_analyzer", None) is not None:
        return request.app.state.image_analyzer
    if settings.llm_api_key:
        analyzer: ImageAnalyzer = FallbackImageAnalyzer(
            CompatibleVision(
                base_url=settings.llm_base_url,
                api_key=settings.llm_api_key,
                model_name=settings.resolved_vision_model(),
            ),
            RapidOcrAnalyzer(),
        )
    else:
        analyzer = RapidOcrAnalyzer()
    request.app.state.image_analyzer = analyzer
    return analyzer


def get_ingest_service(request: Request) -> IngestService:
    settings = get_settings(request)
    return IngestService(
        get_repository(request),
        get_embeddings(request),
        files_dir=settings.files_dir.resolve(),
        seed_dir=SEED_DIR,
        image_analyzer=get_image_analyzer(request),
    )
