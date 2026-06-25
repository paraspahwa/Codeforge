from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException

from .deploy_readiness import is_production_environment

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
JWT_ALGORITHM = "HS256"
JWT_TTL_HOURS = int(os.getenv("CODEFORGE_AUTH_JWT_TTL_HOURS", "168"))


def native_auth_enabled() -> bool:
    flag = os.getenv("CODEFORGE_NATIVE_AUTH_ENABLED", "").strip().lower()
    if flag in {"0", "false", "no"}:
        return False
    if flag in {"1", "true", "yes"}:
        return True
    if is_production_environment():
        return bool(auth_jwt_secret())
    return True


def auth_jwt_secret() -> str:
    secret = (
        os.getenv("CODEFORGE_AUTH_JWT_SECRET", "").strip()
        or os.getenv("SUPABASE_JWT_SECRET", "").strip()
    )
    if secret:
        return secret
    if is_production_environment():
        return ""
    return "local-dev-auth-secret-change-me"


def validate_email(email: str) -> str:
    normalized = email.strip().lower()
    if not EMAIL_PATTERN.match(normalized):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return normalized


def validate_username(username: str) -> str:
    normalized = username.strip().lower()
    if not USERNAME_PATTERN.match(normalized):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3–32 characters (letters, numbers, underscore)",
        )
    return normalized


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must include an uppercase letter")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must include a lowercase letter")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must include a number")


def hash_password(password: str) -> str:
    validate_password(password)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def issue_access_token(*, user_id: str, email: str, username: str) -> str:
    secret = auth_jwt_secret()
    if not secret:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, str]:
    secret = auth_jwt_secret()
    if not secret:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM], options={"verify_aud": False})
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid token subject")
    return {
        "user_id": str(subject),
        "email": str(payload.get("email") or ""),
        "username": str(payload.get("username") or ""),
    }
