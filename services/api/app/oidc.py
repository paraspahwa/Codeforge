from __future__ import annotations

import json
import os
import time
from typing import Any

import httpx
import jwt
from fastapi import HTTPException
from jwt import PyJWKClient


_jwks_client: PyJWKClient | None = None
_jwks_fetched_at: float = 0.0
_JWKS_CACHE_SECONDS = 3600


def oidc_issuer() -> str:
    return os.getenv("CODEFORGE_OIDC_ISSUER", "").strip().rstrip("/")


def oidc_audience() -> str:
    return os.getenv("CODEFORGE_OIDC_AUDIENCE", "").strip()


def oidc_jwks_uri() -> str:
    explicit = os.getenv("CODEFORGE_OIDC_JWKS_URI", "").strip()
    if explicit:
        return explicit
    issuer = oidc_issuer()
    if not issuer:
        return ""
    return f"{issuer}/.well-known/jwks.json"


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client, _jwks_fetched_at
    uri = oidc_jwks_uri()
    if not uri:
        raise HTTPException(status_code=501, detail="OIDC JWKS URI is not configured")

    now = time.time()
    if _jwks_client is None or (now - _jwks_fetched_at) > _JWKS_CACHE_SECONDS:
        _jwks_client = PyJWKClient(uri, cache_keys=True, lifespan=_JWKS_CACHE_SECONDS)
        _jwks_fetched_at = now
    return _jwks_client


async def discover_oidc_configuration() -> dict[str, Any]:
    issuer = oidc_issuer()
    if not issuer:
        raise HTTPException(status_code=501, detail="CODEFORGE_OIDC_ISSUER is not configured")
    url = f"{issuer}/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url)
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Failed to fetch OIDC discovery document")
        return response.json()


def verify_id_token(id_token: str) -> dict[str, Any]:
    uri = oidc_jwks_uri()
    issuer = oidc_issuer()
    audience = oidc_audience()

    if not uri or not issuer:
        raise HTTPException(status_code=501, detail="OIDC issuer/JWKS is not configured")

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(id_token)
        options = {"verify_aud": bool(audience)}
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256", "RS384", "RS512", "ES256", "ES384"],
            audience=audience or None,
            issuer=issuer,
            options=options,
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="OIDC id_token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid OIDC id_token: {exc}") from exc

    subject = payload.get("sub") or payload.get("email")
    if not subject:
        raise HTTPException(status_code=401, detail="OIDC id_token missing subject")
    return payload


def subject_from_id_token(id_token: str) -> str:
    payload = verify_id_token(id_token)
    subject = payload.get("sub") or payload.get("email")
    return str(subject)


def oidc_client_id() -> str:
    return os.getenv("CODEFORGE_OIDC_CLIENT_ID", "").strip()


def oidc_client_secret() -> str:
    return os.getenv("CODEFORGE_OIDC_CLIENT_SECRET", "").strip()


def default_redirect_uri() -> str:
    explicit = os.getenv("CODEFORGE_OIDC_REDIRECT_URI", "").strip()
    if explicit:
        return explicit
    web_base = os.getenv("CODEFORGE_WEB_BASE_URL", "http://localhost:3000").rstrip("/")
    return f"{web_base}/auth/callback"


def public_oidc_config() -> dict[str, Any]:
    return {
        "enabled": os.getenv("CODEFORGE_OIDC_ENABLED", "").strip().lower() in {"1", "true", "yes"},
        "issuer": oidc_issuer(),
        "client_id": oidc_client_id(),
        "redirect_uri": default_redirect_uri(),
        "scopes": os.getenv("CODEFORGE_OIDC_SCOPES", "openid profile email"),
    }


async def build_authorize_url(*, redirect_uri: str, state: str) -> str:
    document = await discover_oidc_configuration()
    authorization_endpoint = document.get("authorization_endpoint")
    client_id = oidc_client_id()
    if not authorization_endpoint or not client_id:
        raise HTTPException(status_code=501, detail="OIDC client_id or authorization endpoint is not configured")

    from urllib.parse import urlencode

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": public_oidc_config()["scopes"],
        "state": state,
    }
    return f"{authorization_endpoint}?{urlencode(params)}"


async def exchange_authorization_code(*, code: str, redirect_uri: str) -> str:
    document = await discover_oidc_configuration()
    token_endpoint = document.get("token_endpoint")
    client_id = oidc_client_id()
    client_secret = oidc_client_secret()
    if not token_endpoint or not client_id:
        raise HTTPException(status_code=501, detail="OIDC token endpoint or client_id is not configured")

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
    }
    if client_secret:
        payload["client_secret"] = client_secret

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(token_endpoint, data=payload)
        if response.status_code >= 400:
            raise HTTPException(status_code=401, detail="OIDC code exchange failed")
        body = response.json()

    id_token = body.get("id_token")
    if not id_token:
        raise HTTPException(status_code=401, detail="OIDC token response missing id_token")
    return subject_from_id_token(str(id_token))
