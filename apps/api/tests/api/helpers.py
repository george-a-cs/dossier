from pathlib import Path

from fastapi.testclient import TestClient

from dossier.api.app import create_app
from dossier.config import Settings

ADMIN_EMAIL = "george@csegoldi.com"
ADMIN_PASSWORD = "Lets_Check@SomethingElse"


def make_settings(tmp_path: Path, **overrides) -> Settings:
    values = {
        "database_path": tmp_path / "app.db",
        "files_dir": tmp_path / "files",
        "auto_seed": False,
        "bootstrap_admin_email": ADMIN_EMAIL,
        "bootstrap_admin_password": ADMIN_PASSWORD,
        "bootstrap_admin_name": "George",
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)


def authenticate(
    client: TestClient,
    email: str = ADMIN_EMAIL,
    password: str = ADMIN_PASSWORD,
) -> dict:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    body = response.json()
    client.headers["Authorization"] = f"Bearer {body['token']}"
    return body


def make_client(tmp_path: Path, *, auth: bool = True, **overrides) -> TestClient:
    client = TestClient(create_app(make_settings(tmp_path, **overrides)))
    if auth:
        authenticate(client)
    return client
