from pathlib import Path

from fastapi.testclient import TestClient

from dossier.api.app import create_app
from dossier.config import Settings


def test_lan_origin_gets_cors_header(tmp_path: Path) -> None:
    settings = Settings(database_path=tmp_path / "unused.db", _env_file=None)
    client = TestClient(create_app(settings))
    response = client.get(
        "/healthz", headers={"Origin": "http://192.168.0.220:3000"}
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://192.168.0.220:3000"


def test_healthz_without_corpus(tmp_path: Path) -> None:
    settings = Settings(database_path=tmp_path / "unused.db", _env_file=None)
    client = TestClient(create_app(settings))
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "X-Request-Id" in response.headers


def test_readyz_ok_with_temp_db(tmp_path: Path) -> None:
    settings = Settings(database_path=tmp_path / "ready.db", _env_file=None)
    client = TestClient(create_app(settings))
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_readyz_503_when_vec_fails(tmp_path: Path, monkeypatch) -> None:
    from dossier.api import routes_health
    from dossier.db.connection import VecExtensionError

    def boom(_path):
        raise VecExtensionError("missing extension")

    monkeypatch.setattr(routes_health, "connect", boom)
    settings = Settings(database_path=tmp_path / "x.db", _env_file=None)
    client = TestClient(create_app(settings))
    response = client.get("/readyz")
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
