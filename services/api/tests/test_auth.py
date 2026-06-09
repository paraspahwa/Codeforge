from __future__ import annotations

import os

import pytest
from fastapi import HTTPException

from app.auth import AuthUser, _token_to_user_id, dev_auth_enabled


def test_dev_auth_enabled_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CODEFORGE_ENV", "development")
    assert dev_auth_enabled() is True


def test_dev_auth_disabled_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CODEFORGE_ENV", "production")
    assert dev_auth_enabled() is False


def test_dev_token_maps_to_user_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CODEFORGE_ENV", "development")
    assert _token_to_user_id("dev_ci-bot") == "ci-bot"


def test_invalid_token_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CODEFORGE_ENV", "production")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    with pytest.raises(HTTPException) as exc:
        _token_to_user_id("not-a-valid-token")
    assert exc.value.status_code == 401


def test_auth_user_dataclass() -> None:
    user = AuthUser(user_id="test-user")
    assert user.user_id == "test-user"
