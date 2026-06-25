from dataclasses import dataclass
import os

from fastapi import Header, HTTPException
import jwt


@dataclass
class AuthUser:
    user_id: str


def dev_login_override_enabled() -> bool:
    return os.getenv("CODEFORGE_ALLOW_DEV_LOGIN", "").strip().lower() in {"1", "true", "yes"}


def dev_login_secret_configured() -> bool:
    return bool(os.getenv("CODEFORGE_DEV_LOGIN_SECRET", "").strip())


def verify_dev_login_secret(request) -> bool:
    """In production with dev-login enabled, require the server-side secret header."""
    from .deploy_readiness import is_production_environment

    if not (is_production_environment() and dev_login_override_enabled()):
        return True
    secret = os.getenv("CODEFORGE_DEV_LOGIN_SECRET", "").strip()
    if not secret:
        return False
    import hmac

    provided = (request.headers.get("X-Codeforge-Dev-Secret") or "").strip()
    return bool(provided) and hmac.compare_digest(provided, secret)


def dev_auth_enabled() -> bool:
    if dev_login_override_enabled():
        return True
    if oidc_auth_enabled():
        return False
    return os.getenv("CODEFORGE_ENV", "development").strip().lower() != "production"


def oidc_auth_enabled() -> bool:
    return os.getenv("CODEFORGE_OIDC_ENABLED", "").strip().lower() in {"1", "true", "yes"}


def _token_to_user_id(token: str) -> str:
    if dev_auth_enabled() and token.startswith("dev_") and len(token) > 4:
        return token[4:]
    if oidc_auth_enabled() and token.startswith("oidc_") and len(token) > 5:
        return token[5:]
    if oidc_auth_enabled() and token.count(".") == 2:
        from .oidc import subject_from_id_token

        return subject_from_id_token(token)
    from .native_auth import auth_jwt_secret, decode_access_token, native_auth_enabled

    if native_auth_enabled() and token.count(".") == 2 and auth_jwt_secret():
        try:
            return decode_access_token(token)["user_id"]
        except HTTPException:
            pass
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
    authorization: str | None = Header(default=None),
) -> AuthUser | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_id = _token_to_user_id(token)
    except HTTPException:
        return None
    return AuthUser(user_id=user_id)


def resolve_user_from_token(token: str) -> AuthUser | None:
    if not token or not token.strip():
        return None
    try:
        return AuthUser(user_id=_token_to_user_id(token.strip()))
    except HTTPException:
        return None
