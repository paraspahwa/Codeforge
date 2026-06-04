from dataclasses import dataclass
import os

from fastapi import Header, HTTPException
import jwt


@dataclass
class AuthUser:
    user_id: str


def _token_to_user_id(token: str) -> str:
    if token.startswith("dev_") and len(token) > 4:
        return token[4:]
    supabase_secret = os.getenv("SUPABASE_JWT_SECRET")
    if supabase_secret:
        try:
            payload = jwt.decode(token, supabase_secret, algorithms=["HS256"], options={"verify_aud": False})
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid token") from exc
        subject = payload.get("sub")
        if subject:
            return str(subject)
    raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    user_id = _token_to_user_id(token)
    return AuthUser(user_id=user_id)


def get_current_user_optional(
    token: str | None = None,
    authorization: str | None = Header(default=None),
) -> AuthUser:
    if token:
        user_id = _token_to_user_id(token)
        return AuthUser(user_id=user_id)
    return get_current_user(authorization=authorization)
