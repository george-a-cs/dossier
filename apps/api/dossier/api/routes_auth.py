from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dossier.api.deps import (
    get_bearer_token,
    get_repository,
    require_super_admin,
    require_user,
)
from dossier.auth.passwords import hash_password, verify_password
from dossier.auth.service import (
    ROLE_MEMBER,
    login,
    logout,
    normalize_email,
    public_user,
)
from dossier.ports.repository import Repository, User

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LoginBody(BaseModel):
    email: str
    password: str


class CreateUserBody(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=8)


class UpdateProfileBody(BaseModel):
    name: str | None = None
    email: str | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8)


def _clean_name(name: str) -> str:
    return " ".join(name.split())


def _require_email(email: str) -> str:
    normalized = normalize_email(email)
    if not _EMAIL_RE.match(normalized):
        raise HTTPException(status_code=400, detail="Enter a valid email")
    return normalized


@router.post("/auth/login")
def login_user(body: LoginBody, repo: Repository = Depends(get_repository)) -> dict:
    result = login(repo, body.email, body.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token, user = result
    return {"token": token, "user": public_user(user)}


@router.post("/auth/logout", status_code=204)
def logout_user(
    token: str = Depends(get_bearer_token),
    repo: Repository = Depends(get_repository),
    _user: User = Depends(require_user),
) -> None:
    logout(repo, token)


@router.get("/auth/me")
def me(user: User = Depends(require_user)) -> dict:
    return public_user(user)


@router.patch("/auth/me")
def update_me(
    body: UpdateProfileBody,
    user: User = Depends(require_user),
    repo: Repository = Depends(get_repository),
) -> dict:
    name = _clean_name(body.name) if body.name is not None else user.name
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    email = _require_email(body.email) if body.email is not None else user.email
    if email != user.email:
        taken = repo.get_user_by_email(email)
        if taken is not None:
            raise HTTPException(status_code=409, detail="That email is already in use")

    password_hash = None
    if body.new_password is not None:
        if not body.current_password or not verify_password(
            body.current_password, user.password_hash
        ):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        password_hash = hash_password(body.new_password)

    updated = repo.update_user(
        user.id, name=name, email=email, password_hash=password_hash
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user(updated)


@router.get("/users")
def list_users(
    _admin: User = Depends(require_super_admin),
    repo: Repository = Depends(get_repository),
) -> list[dict]:
    return [public_user(item) for item in repo.list_users()]


@router.post("/users", status_code=201)
def create_user(
    body: CreateUserBody,
    _admin: User = Depends(require_super_admin),
    repo: Repository = Depends(get_repository),
) -> dict:
    name = _clean_name(body.name)
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    email = _require_email(body.email)
    if repo.get_user_by_email(email) is not None:
        raise HTTPException(status_code=409, detail="That email is already in use")
    created = repo.create_user(
        id=str(uuid.uuid4()),
        name=name,
        email=email,
        password_hash=hash_password(body.password),
        role=ROLE_MEMBER,
    )
    return public_user(created)
