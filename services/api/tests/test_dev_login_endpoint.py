from __future__ import annotations

from app.db import init_db


def test_dev_login_returns_not_found_when_oidc_enabled(client, monkeypatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_ENV", "development")
    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")

    response = client.post("/api/v1/auth/dev-login", json={"user_id": "blocked-user"})
    assert response.status_code == 404


def test_dev_login_allowed_with_ci_override(client, monkeypatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_ENV", "production")
    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")
    monkeypatch.setenv("CODEFORGE_ALLOW_DEV_LOGIN", "true")

    response = client.post("/api/v1/auth/dev-login", json={"user_id": "ci-bot"})
    assert response.status_code == 200
    assert response.json()["access_token"] == "dev_ci-bot"
