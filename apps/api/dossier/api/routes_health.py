from __future__ import annotations

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from dossier.db.connection import VecExtensionError, connect

router = APIRouter()


@router.get("/favicon.ico")
def favicon() -> Response:
    return Response(status_code=204)


@router.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz")
def readyz(request: Request) -> JSONResponse:
    settings = request.app.state.settings
    try:
        conn = connect(settings.database_path)
        conn.execute("SELECT 1")
        conn.close()
    except VecExtensionError as exc:
        return JSONResponse(status_code=503, content={"status": "not_ready", "error": str(exc)})
    except Exception as exc:
        return JSONResponse(status_code=503, content={"status": "not_ready", "error": str(exc)})
    return JSONResponse(status_code=200, content={"status": "ready"})
