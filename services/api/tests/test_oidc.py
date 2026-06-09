from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.db import init_db
from app.oidc_state import consume_oidc_state, register_oidc_state


def test_oidc_authorize_url_registers_state(client, monkeypatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")
    monkeypatch.setenv("CODEFORGE_OIDC_CLIENT_ID", "test-client")
    monkeypatch.setenv("CODEFORGE_OIDC_ISSUER", "https://idp.example.com")

    with patch(
        "app.oidc.discover_oidc_configuration",
        new_callable=AsyncMock,
        return_value={"authorization_endpoint": "https://idp.example.com/authorize"},
    ):
        response = client.get(
            "/api/v1/auth/oidc/authorize-url",
            params={"redirect_uri": "http://localhost:3000/auth/callback", "state": "cf_teststate"},
        )

    assert response.status_code == 200
    body = response.json()
    assert "authorize_url" in body
    assert body["state"] == "cf_teststate"
    assert consume_oidc_state("cf_teststate", redirect_uri="http://localhost:3000/auth/callback") is True


def test_oidc_callback_rejects_invalid_state(client, monkeypatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")
    monkeypatch.setenv("CODEFORGE_OIDC_CLIENT_ID", "test-client")

    response = client.post(
        "/api/v1/auth/oidc/callback",
        json={
            "code": "abc123",
            "state": "missing-state",
            "redirect_uri": "http://localhost:3000/auth/callback",
        },
    )
    assert response.status_code == 400
    assert "state" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_oidc_callback_exchanges_code(client, monkeypatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")
    monkeypatch.setenv("CODEFORGE_OIDC_CLIENT_ID", "test-client")
    register_oidc_state("cf_goodstate", redirect_uri="http://localhost:3000/auth/callback")

    with patch(
        "app.oidc.exchange_authorization_code",
        new_callable=AsyncMock,
        return_value="alice@example.com",
    ):
        response = client.post(
            "/api/v1/auth/oidc/callback",
            json={
                "code": "abc123",
                "state": "cf_goodstate",
                "redirect_uri": "http://localhost:3000/auth/callback",
            },
        )

    assert response.status_code == 200
    assert response.json()["access_token"] == "oidc_alice@example.com"
