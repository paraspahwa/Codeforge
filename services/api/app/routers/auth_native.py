from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ..account_store import (
    create_account,
    get_account_by_email,
    get_account_by_id,
    get_account_by_username,
    update_password_hash,
)
from ..auth import AuthUser, get_current_user, oidc_auth_enabled
from ..models import (
    AccountProfileResponse,
    AuthConfigResponse,
    ChangePasswordRequest,
    DevLoginResponse,
    NativeLoginRequest,
    NativeRegisterRequest,
)
from ..native_auth import (
    hash_password,
    issue_access_token,
    native_auth_enabled,
    validate_email,
    validate_password,
    validate_username,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _require_native_auth() -> None:
    if not native_auth_enabled():
        raise HTTPException(status_code=404, detail="Not found")


def _enforce_auth_rate_limit(request: Request, scope: str) -> None:
    import time

    from fastapi import HTTPException

    from ..state import redis_session_store

    client_host = request.client.host if request.client else "unknown"
    window = int(time.time() // 60)
    key = f"ratelimit:{scope}:{client_host}:{window}"
    count = redis_session_store.incr_with_ttl(key, 120)
    if count > 20:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in a minute.")


@router.get("/config", response_model=AuthConfigResponse)
def auth_config() -> AuthConfigResponse:
    from ..auth import dev_auth_enabled

    from ..supabase_config import supabase_auth_configured

    return AuthConfigResponse(
        native_enabled=native_auth_enabled(),
        supabase_enabled=supabase_auth_configured(),
        oidc_enabled=oidc_auth_enabled(),
        dev_enabled=dev_auth_enabled(),
    )


@router.post("/register", response_model=DevLoginResponse)
def register_account(payload: NativeRegisterRequest, request: Request) -> DevLoginResponse:
    _require_native_auth()
    _enforce_auth_rate_limit(request, "register")

    email = validate_email(payload.email)
    username = validate_username(payload.username)
    validate_password(payload.password)

    if get_account_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if get_account_by_username(username):
        raise HTTPException(status_code=409, detail="This username is already taken")

    password_hash = hash_password(payload.password)
    account = create_account(email=email, username=username, password_hash=password_hash)
    token = issue_access_token(
        user_id=account["user_id"],
        email=account["email"],
        username=account["username"],
    )
    return DevLoginResponse(access_token=token)


@router.post("/login", response_model=DevLoginResponse)
def login_account(payload: NativeLoginRequest, request: Request) -> DevLoginResponse:
    _require_native_auth()
    _enforce_auth_rate_limit(request, "login")

    email = validate_email(payload.email)
    account = get_account_by_email(email)
    if not account or not verify_password(payload.password, account["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = issue_access_token(
        user_id=account["user_id"],
        email=account["email"],
        username=account["username"],
    )
    return DevLoginResponse(access_token=token)


@router.get("/me", response_model=AccountProfileResponse)
def account_profile(user: AuthUser = Depends(get_current_user)) -> AccountProfileResponse:
    _require_native_auth()
    account = get_account_by_id(user.user_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return AccountProfileResponse(
        user_id=account["user_id"],
        email=account["email"],
        username=account["username"],
        created_at=account["created_at"],
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, str]:
    _require_native_auth()
    account = get_account_by_id(user.user_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if not verify_password(payload.current_password, account["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    validate_password(payload.new_password)
    update_password_hash(user.user_id, hash_password(payload.new_password))
    return {"status": "ok"}
