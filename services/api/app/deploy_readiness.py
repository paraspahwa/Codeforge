from __future__ import annotations

import hashlib
import hmac
import os
from typing import Any
from urllib.parse import urlparse

from .auth import dev_auth_enabled, oidc_auth_enabled


def is_production_environment() -> bool:
    return os.getenv("CODEFORGE_ENV", "development").strip().lower() == "production"


def _is_placeholder_url(value: str) -> bool:
    lowered = value.lower()
    return not value or "placeholder" in lowered or "yourdomain" in lowered


def _add_check(
    checks: list[dict[str, Any]],
    *,
    name: str,
    ok: bool,
    detail: str = "",
    required: bool = True,
) -> None:
    checks.append(
        {
            "name": name,
            "ok": ok,
            "detail": detail,
            "required": required,
        }
    )


def collect_deploy_readiness() -> dict[str, Any]:
    checks: list[dict[str, Any]] = []

    _add_check(
        checks,
        name="database_url",
        ok=bool(os.getenv("DATABASE_URL", "").strip() or os.getenv("PGHOST", "").strip()),
        detail="DATABASE_URL or PGHOST must be configured for production deployments",
    )

    redis_url = os.getenv("REDIS_URL", "").strip()
    celery_broker = os.getenv("CELERY_BROKER_URL", "").strip()
    _add_check(
        checks,
        name="task_queue_backend",
        ok=bool(redis_url or celery_broker),
        detail="REDIS_URL or CELERY_BROKER_URL is required for worker-backed jobs",
    )

    if oidc_auth_enabled():
        issuer = os.getenv("CODEFORGE_OIDC_ISSUER", "").strip()
        client_id = os.getenv("CODEFORGE_OIDC_CLIENT_ID", "").strip()
        client_secret = os.getenv("CODEFORGE_OIDC_CLIENT_SECRET", "").strip()
        redirect_uri = os.getenv("CODEFORGE_OIDC_REDIRECT_URI", "").strip()
        jwks_uri = os.getenv("CODEFORGE_OIDC_JWKS_URI", "").strip()
        audience = os.getenv("CODEFORGE_OIDC_AUDIENCE", "").strip()

        _add_check(checks, name="oidc_issuer", ok=bool(issuer), detail="CODEFORGE_OIDC_ISSUER")
        _add_check(checks, name="oidc_client_id", ok=bool(client_id), detail="CODEFORGE_OIDC_CLIENT_ID")
        _add_check(checks, name="oidc_client_secret", ok=bool(client_secret), detail="CODEFORGE_OIDC_CLIENT_SECRET")
        _add_check(checks, name="oidc_redirect_uri", ok=bool(redirect_uri), detail="CODEFORGE_OIDC_REDIRECT_URI")
        _add_check(
            checks,
            name="oidc_jwks_uri",
            ok=bool(jwks_uri or issuer),
            detail="CODEFORGE_OIDC_JWKS_URI or issuer-derived JWKS",
        )
        _add_check(
            checks,
            name="oidc_audience",
            ok=bool(audience),
            detail="CODEFORGE_OIDC_AUDIENCE",
            required=False,
        )
        _add_check(
            checks,
            name="dev_login_disabled_under_oidc",
            ok=not dev_auth_enabled(),
            detail="Dev-login must be disabled when OIDC is enabled",
        )
    else:
        _add_check(
            checks,
            name="oidc_disabled",
            ok=True,
            detail="OIDC is disabled; dev-login or Supabase JWT auth is expected",
            required=False,
        )
        if is_production_environment():
            _add_check(
                checks,
                name="supabase_jwt_secret",
                ok=bool(os.getenv("SUPABASE_JWT_SECRET", "").strip()),
                detail="SUPABASE_JWT_SECRET is required when OIDC is disabled in production",
            )

    razorpay_key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    razorpay_key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    _add_check(
        checks,
        name="razorpay_key_id",
        ok=bool(razorpay_key_id),
        detail="RAZORPAY_KEY_ID for checkout and webhook verification",
        required=is_production_environment(),
    )
    _add_check(
        checks,
        name="razorpay_key_secret",
        ok=bool(razorpay_key_secret),
        detail="RAZORPAY_KEY_SECRET for payment signature and webhook HMAC",
        required=is_production_environment(),
    )

    web_base_url = os.getenv("CODEFORGE_WEB_BASE_URL", "").strip()
    public_web_required = is_production_environment() and not web_base_url.startswith("http://localhost")
    _add_check(
        checks,
        name="public_web_base_url",
        ok=bool(web_base_url) and not _is_placeholder_url(web_base_url),
        detail="CODEFORGE_WEB_BASE_URL must be a real public origin for OIDC redirects",
        required=public_web_required,
    )

    if oidc_auth_enabled():
        redirect_uri = os.getenv("CODEFORGE_OIDC_REDIRECT_URI", "").strip()
        if web_base_url and redirect_uri:
            expected_suffix = "/auth/callback"
            redirect_ok = redirect_uri.startswith(web_base_url.rstrip("/")) and redirect_uri.endswith(expected_suffix)
            _add_check(
                checks,
                name="oidc_redirect_uri_matches_web_base",
                ok=redirect_ok,
                detail="CODEFORGE_OIDC_REDIRECT_URI should be {CODEFORGE_WEB_BASE_URL}/auth/callback",
                required=public_web_required,
            )

    qdrant_url = os.getenv("QDRANT_URL", "").strip()
    _add_check(
        checks,
        name="qdrant_url",
        ok=bool(qdrant_url),
        detail="QDRANT_URL for context/RAG vector storage",
        required=is_production_environment(),
    )

    if is_production_environment() and not oidc_auth_enabled():
        _add_check(
            checks,
            name="oidc_disabled_in_production",
            ok=True,
            detail="OIDC is disabled in production; enable SSO before go-live when ready",
            required=False,
        )

    host_prefix = os.getenv("CODEFORGE_WORKSPACES_HOST_PREFIX", "").strip()
    container_prefix = os.getenv("CODEFORGE_WORKSPACES_CONTAINER_PREFIX", "").strip()
    _add_check(
        checks,
        name="workspace_host_prefix",
        ok=bool(host_prefix),
        detail="CODEFORGE_WORKSPACES_HOST_PREFIX for worker file jobs",
        required=False,
    )
    _add_check(
        checks,
        name="workspace_container_prefix",
        ok=bool(container_prefix),
        detail="CODEFORGE_WORKSPACES_CONTAINER_PREFIX for worker mounts",
        required=False,
    )

    required_checks = [item for item in checks if item.get("required", True)]
    ready = all(item["ok"] for item in required_checks)

    return {
        "ready": ready,
        "oidc_enabled": oidc_auth_enabled(),
        "environment": os.getenv("CODEFORGE_ENV", "development"),
        "checks": checks,
    }


async def probe_oidc_discovery() -> dict[str, Any]:
    if not oidc_auth_enabled():
        return {"ok": True, "detail": "OIDC disabled"}

    issuer = os.getenv("CODEFORGE_OIDC_ISSUER", "").strip()
    if not issuer:
        return {"ok": False, "detail": "CODEFORGE_OIDC_ISSUER is not configured"}

    from .oidc import discover_oidc_configuration

    try:
        document = await discover_oidc_configuration()
    except Exception as exc:  # noqa: BLE001 - surface deploy blocker detail
        return {"ok": False, "detail": str(exc)}

    authorization_endpoint = document.get("authorization_endpoint")
    token_endpoint = document.get("token_endpoint")
    if not authorization_endpoint or not token_endpoint:
        return {"ok": False, "detail": "OIDC discovery document missing authorization/token endpoints"}

    return {
        "ok": True,
        "detail": "OIDC discovery document reachable",
        "issuer": document.get("issuer") or issuer,
        "authorization_endpoint": authorization_endpoint,
        "token_endpoint": token_endpoint,
    }


def probe_billing_webhook() -> dict[str, Any]:
    secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    if not secret:
        return {"ok": False, "detail": "RAZORPAY_KEY_SECRET is not configured"}

    payload = b'{"event":"billing.probe"}'
    signature = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return {
        "ok": True,
        "detail": "Webhook HMAC signer configured",
        "signature_prefix": signature[:12],
    }


def probe_vector_store() -> dict[str, Any]:
    qdrant_url = os.getenv("QDRANT_URL", "").strip()
    if not qdrant_url:
        return {"ok": False, "detail": "QDRANT_URL is not configured"}

    from .state import vector_store

    if not vector_store.ping():
        return {"ok": False, "detail": "Qdrant ping failed", "backend": vector_store.backend}

    if vector_store.backend != "qdrant":
        return {
            "ok": False,
            "detail": f"Vector store backend is {vector_store.backend}, expected qdrant",
            "backend": vector_store.backend,
        }

    result: dict[str, Any] = {
        "ok": True,
        "detail": "Qdrant reachable",
        "backend": vector_store.backend,
        "embedding_source": vector_store.embedding_source,
    }

    if os.getenv("OPENAI_API_KEY", "").strip():
        vector_store.upsert_text("__deploy_probe__", "deploy readiness probe", {"probe": True})
        result["embedding_source"] = vector_store.embedding_source
        if vector_store.embedding_source != "real":
            return {
                "ok": False,
                "detail": "OPENAI_API_KEY is set but real embeddings are unavailable",
                **result,
            }

    return result


def public_api_webhook_url() -> str | None:
    public_base = os.getenv("CODEFORGE_PUBLIC_API_BASE", "").strip()
    if not public_base:
        web_base = os.getenv("CODEFORGE_WEB_BASE_URL", "").strip()
        if web_base and not _is_placeholder_url(web_base):
            parsed = urlparse(web_base)
            if parsed.hostname and parsed.hostname.startswith("api."):
                public_base = web_base
    if not public_base or _is_placeholder_url(public_base):
        return None
    return f"{public_base.rstrip('/')}/api/v1/billing/webhook"
