from pathlib import Path

from fastapi.testclient import TestClient

from dossier.api.app import create_app
from dossier.api.middleware import is_public_request
from dossier.auth.passwords import hash_password, verify_password
from tests.api.helpers import ADMIN_EMAIL, ADMIN_PASSWORD, authenticate, make_client, make_settings


def test_only_login_and_health_are_public() -> None:
    assert is_public_request("GET", "/healthz")
    assert is_public_request("GET", "/readyz")
    assert is_public_request("POST", "/auth/login")
    assert is_public_request("OPTIONS", "/collections/default/documents")
    assert not is_public_request("GET", "/collections/default/documents")
    assert not is_public_request("GET", "/auth/me")
    assert not is_public_request("GET", "/docs")


def test_bootstrap_skipped_without_env(tmp_path: Path) -> None:
    settings = make_settings(
        tmp_path,
        bootstrap_admin_email="",
        bootstrap_admin_password="",
    )
    client = TestClient(create_app(settings))
    response = client.post(
        "/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 401


def test_bootstrap_admin_can_log_in(tmp_path: Path) -> None:
    client = make_client(tmp_path, auth=False)
    response = client.post(
        "/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == ADMIN_EMAIL
    assert body["user"]["role"] == "super_admin"
    assert body["user"]["name"] == "George"
    assert "password" not in body["user"]
    assert body["token"]


def test_login_rejects_wrong_password(tmp_path: Path) -> None:
    client = make_client(tmp_path, auth=False)
    response = client.post(
        "/auth/login",
        json={"email": ADMIN_EMAIL, "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_protected_routes_require_auth(tmp_path: Path) -> None:
    client = make_client(tmp_path, auth=False)
    assert client.get("/healthz").status_code == 200

    blocked = [
        client.get("/docs"),
        client.get("/redoc"),
        client.get("/openapi.json"),
        client.get("/auth/me"),
        client.post("/auth/logout"),
        client.patch("/auth/me", json={"name": "X"}),
        client.get("/users"),
        client.post("/users", json={"name": "A", "email": "a@b.co", "password": "password1"}),
        client.post("/collections", json={"id": "default", "name": "Default"}),
        client.get("/collections/default/documents"),
        client.post("/collections/default/seed"),
        client.get("/documents/missing"),
        client.patch("/documents/missing", json={"notes": "x"}),
        client.get("/documents/missing/file"),
        client.get("/documents/missing/chunks"),
        client.delete("/documents/missing"),
        client.post("/collections/default/brief", json={"question": "Hi"}),
        client.get("/collections/default/events"),
        client.get("/chunks/missing"),
        client.get("/briefs"),
        client.get("/briefs/missing"),
        client.put("/briefs/missing", json={"turns": []}),
        client.delete("/briefs/missing"),
    ]
    assert all(response.status_code == 401 for response in blocked)


def test_me_and_logout(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == ADMIN_EMAIL
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_update_profile_and_password(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    updated = client.patch(
        "/auth/me",
        json={
            "name": "George C",
            "email": "george@csegoldi.com",
            "current_password": ADMIN_PASSWORD,
            "new_password": "Another_Check@123",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "George C"
    client.headers.pop("Authorization", None)
    assert (
        client.post(
            "/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        ).status_code
        == 401
    )
    again = authenticate(client, password="Another_Check@123")
    assert again["user"]["name"] == "George C"


def test_password_change_needs_current(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    response = client.patch("/auth/me", json={"new_password": "Another_Check@123"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"


def test_super_admin_adds_user(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    created = client.post(
        "/users",
        json={
            "name": "Analyst",
            "email": "analyst@example.com",
            "password": "Member_Pass@1",
        },
    )
    assert created.status_code == 201
    assert created.json()["email"] == "analyst@example.com"
    assert created.json()["role"] == "member"
    listed = client.get("/users")
    assert listed.status_code == 200
    emails = {item["email"] for item in listed.json()}
    assert emails == {ADMIN_EMAIL, "analyst@example.com"}

    member = TestClient(client.app)
    authenticate(member, email="analyst@example.com", password="Member_Pass@1")
    denied = member.post(
        "/users",
        json={"name": "Other", "email": "other@example.com", "password": "Member_Pass@2"},
    )
    assert denied.status_code == 403
    assert member.get("/users").status_code == 403


def test_duplicate_email_is_conflict(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    response = client.post(
        "/users",
        json={"name": "Copy", "email": ADMIN_EMAIL, "password": "Member_Pass@1"},
    )
    assert response.status_code == 409


def test_bootstrap_does_not_reset_password(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    first = TestClient(create_app(settings))
    authenticate(first)
    first.patch(
        "/auth/me",
        json={"current_password": ADMIN_PASSWORD, "new_password": "Changed_Once@9"},
    )
    second = TestClient(create_app(settings))
    assert (
        second.post(
            "/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        ).status_code
        == 401
    )
    ok = second.post(
        "/auth/login",
        json={"email": ADMIN_EMAIL, "password": "Changed_Once@9"},
    )
    assert ok.status_code == 200


def test_password_hash_roundtrip() -> None:
    stored = hash_password("Lets_Check@SomethingElse")
    assert stored.startswith("pbkdf2_sha256$")
    assert "Lets_Check@SomethingElse" not in stored
    assert verify_password("Lets_Check@SomethingElse", stored)
    assert not verify_password("nope", stored)
