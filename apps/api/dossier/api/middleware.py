from __future__ import annotations

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from dossier.observability.logging import bind_request_id

log = structlog.get_logger("dossier.http")

# Ops probes plus the login form. Everything else needs a session.
PUBLIC_PATHS = frozenset({"/healthz", "/readyz", "/favicon.ico", "/auth/login"})


def is_public_request(method: str, path: str) -> bool:
    if method == "OPTIONS":
        return True
    return path in PUBLIC_PATHS


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        bind_request_id(request_id)
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["X-Request-Id"] = request_id
        log.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        return response


class AuthGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if is_public_request(request.method, request.url.path):
            return await call_next(request)

        header = request.headers.get("Authorization") or ""
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        from dossier.api.deps import _repository
        from dossier.auth.service import user_from_token

        settings = request.app.state.settings
        user = user_from_token(_repository(str(settings.database_path.resolve())), token.strip())
        if user is None:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
        request.state.user = user
        return await call_next(request)
