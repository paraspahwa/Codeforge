from __future__ import annotations



from unittest.mock import AsyncMock, patch



from app.db import init_db





def test_deploy_readiness_passes_without_oidc(client, monkeypatch) -> None:

    init_db()

    monkeypatch.delenv("CODEFORGE_OIDC_ENABLED", raising=False)

    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")

    response = client.get("/api/v1/platform/deploy-readiness")

    assert response.status_code == 200

    body = response.json()

    assert body["ready"] is True

    assert body["oidc_enabled"] is False





def test_deploy_readiness_fails_when_oidc_enabled_but_incomplete(client, monkeypatch) -> None:

    init_db()

    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")

    monkeypatch.setenv("DATABASE_URL", "postgresql://example")

    monkeypatch.delenv("CODEFORGE_OIDC_ISSUER", raising=False)

    monkeypatch.delenv("CODEFORGE_OIDC_CLIENT_ID", raising=False)



    response = client.get("/api/v1/platform/deploy-readiness")

    assert response.status_code == 200

    body = response.json()

    assert body["ready"] is False

    assert body["oidc_enabled"] is True

    assert any(check["name"] == "oidc_issuer" and not check["ok"] for check in body["checks"])





def test_deploy_readiness_discovery_probe_marks_not_ready(client, monkeypatch) -> None:

    init_db()

    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")

    monkeypatch.setenv("DATABASE_URL", "postgresql://example")

    monkeypatch.setenv("CODEFORGE_OIDC_ISSUER", "https://idp.example.com")

    monkeypatch.setenv("CODEFORGE_OIDC_CLIENT_ID", "client")

    monkeypatch.setenv("CODEFORGE_OIDC_CLIENT_SECRET", "secret")

    monkeypatch.setenv("CODEFORGE_OIDC_REDIRECT_URI", "http://localhost:3000/auth/callback")



    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.delenv("CODEFORGE_ALLOW_DEV_LOGIN", raising=False)

    with patch(
        "app.oidc.discover_oidc_configuration",
        new_callable=AsyncMock,
        side_effect=RuntimeError("discovery unreachable"),
    ):

        response = client.get("/api/v1/platform/deploy-readiness", params={"probe_discovery": "true"})



    assert response.status_code == 200

    body = response.json()

    assert body["ready"] is False

    assert body["oidc_discovery"]["ok"] is False





def test_deploy_readiness_requires_razorpay_in_production(client, monkeypatch) -> None:

    init_db()

    monkeypatch.setenv("CODEFORGE_ENV", "production")

    monkeypatch.delenv("CODEFORGE_OIDC_ENABLED", raising=False)

    monkeypatch.setenv("DATABASE_URL", "postgresql://example")

    monkeypatch.setenv("SUPABASE_JWT_SECRET", "jwt-secret")

    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)

    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)



    response = client.get("/api/v1/platform/deploy-readiness")

    body = response.json()

    assert body["ready"] is False

    assert any(check["name"] == "razorpay_key_id" and not check["ok"] for check in body["checks"])





def test_deploy_readiness_billing_probe_fails_without_secret(client, monkeypatch) -> None:

    init_db()

    monkeypatch.setenv("CODEFORGE_ENV", "production")

    monkeypatch.setenv("DATABASE_URL", "postgresql://example")

    monkeypatch.setenv("SUPABASE_JWT_SECRET", "jwt-secret")

    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_1")

    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)



    response = client.get("/api/v1/platform/deploy-readiness", params={"probe_billing": "true"})

    body = response.json()

    assert body["billing_webhook"]["ok"] is False

    assert body["ready"] is False





def test_deploy_readiness_requires_qdrant_in_production(client, monkeypatch) -> None:

    init_db()

    monkeypatch.setenv("CODEFORGE_ENV", "production")

    monkeypatch.setenv("DATABASE_URL", "postgresql://example")

    monkeypatch.setenv("SUPABASE_JWT_SECRET", "jwt-secret")

    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test")

    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")

    monkeypatch.delenv("QDRANT_URL", raising=False)



    response = client.get("/api/v1/platform/deploy-readiness")

    body = response.json()

    assert body["ready"] is False

    assert any(check["name"] == "qdrant_url" and not check["ok"] for check in body["checks"])





def test_deploy_readiness_requires_dev_login_disabled_when_oidc_on(client, monkeypatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_ENV", "development")
    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    monkeypatch.setenv("CODEFORGE_OIDC_ISSUER", "https://idp.example.com")
    monkeypatch.setenv("CODEFORGE_OIDC_CLIENT_ID", "client")
    monkeypatch.setenv("CODEFORGE_OIDC_CLIENT_SECRET", "secret")
    monkeypatch.setenv("CODEFORGE_OIDC_REDIRECT_URI", "http://localhost:3000/auth/callback")
    monkeypatch.setenv("CODEFORGE_ALLOW_DEV_LOGIN", "true")

    response = client.get("/api/v1/platform/deploy-readiness")
    body = response.json()
    assert body["ready"] is False
    assert any(
        check["name"] == "dev_login_disabled_under_oidc" and not check["ok"] for check in body["checks"]
    )


def test_deploy_readiness_vector_probe_fails_without_qdrant_url(client, monkeypatch) -> None:

    init_db()

    monkeypatch.setenv("CODEFORGE_ENV", "production")

    monkeypatch.setenv("DATABASE_URL", "postgresql://example")

    monkeypatch.delenv("QDRANT_URL", raising=False)



    response = client.get("/api/v1/platform/deploy-readiness", params={"probe_vector": "true"})

    body = response.json()

    assert body["vector_store"]["ok"] is False

    assert body["ready"] is False


