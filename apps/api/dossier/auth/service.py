from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from dossier.auth.passwords import hash_password, verify_password
from dossier.config import Settings
from dossier.ports.repository import Repository, User

SESSION_DAYS = 30
ROLE_SUPER_ADMIN = "super_admin"
ROLE_MEMBER = "member"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at,
    }


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def bootstrap_admin(repo: Repository, settings: Settings) -> User:
    email = normalize_email(settings.bootstrap_admin_email)
    existing = repo.get_user_by_email(email)
    if existing:
        return existing
    return repo.create_user(
        id=str(uuid.uuid4()),
        name=settings.bootstrap_admin_name.strip() or "Admin",
        email=email,
        password_hash=hash_password(settings.bootstrap_admin_password),
        role=ROLE_SUPER_ADMIN,
    )


def login(repo: Repository, email: str, password: str) -> tuple[str, User] | None:
    user = repo.get_user_by_email(normalize_email(email))
    if user is None or not verify_password(password, user.password_hash):
        return None
    token = secrets.token_urlsafe(32)
    expires = datetime.now(UTC) + timedelta(days=SESSION_DAYS)
    repo.create_session(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=expires.isoformat(),
    )
    return token, user


def user_from_token(repo: Repository, token: str) -> User | None:
    session = repo.get_session_by_token_hash(hash_token(token))
    if session is None:
        return None
    try:
        expires = datetime.fromisoformat(session.expires_at)
    except ValueError:
        repo.delete_session_by_token_hash(session.token_hash)
        return None
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires <= datetime.now(UTC):
        repo.delete_session_by_token_hash(session.token_hash)
        return None
    return repo.get_user(session.user_id)


def logout(repo: Repository, token: str) -> None:
    repo.delete_session_by_token_hash(hash_token(token))
