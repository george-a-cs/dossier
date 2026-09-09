from __future__ import annotations

import structlog
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from dossier.api.deps import require_user, seed_bootstrap_admin, seed_default_corpus
from dossier.api.middleware import AuthGateMiddleware, RequestIdMiddleware
from dossier.api.routes_auth import router as auth_router
from dossier.api.routes_brief import router as brief_router
from dossier.api.routes_health import router as health_router
from dossier.api.routes_ingest import router as ingest_router
from dossier.config import LAN_UI_ORIGIN, Settings, get_settings
from dossier.observability.logging import configure_logging

log = structlog.get_logger("dossier.http")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Dossier",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.settings = settings
    # Last added runs first: CORS → request id → auth gate → routes.
    app.add_middleware(AuthGateMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins(),
        allow_origin_regex=LAN_UI_ORIGIN,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition", "X-Request-Id"],
    )

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled", path=request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    seed_bootstrap_admin(settings)
    seed_default_corpus(settings)

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(ingest_router, dependencies=[Depends(require_user)])
    app.include_router(brief_router, dependencies=[Depends(require_user)])
    return app


app = create_app()
