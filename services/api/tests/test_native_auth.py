"""Tests for native email/password authentication."""

from __future__ import annotations

import os

import pytest


@pytest.fixture(autouse=True)
def _enable_native_auth(monkeypatch):
    monkeypatch.setenv("CODEFORGE_NATIVE_AUTH_ENABLED", "true")
    monkeypatch.setenv("CODEFORGE_AUTH_JWT_SECRET", "test-native-auth-secret")
    monkeypatch.setenv("CODEFORGE_ALLOW_DEV_LOGIN", "false")


def test_register_login_and_profile(client) -> None:
    register = client.post(
        "/api/v1/auth/register",
        json={
            "email": "native-user@example.com",
            "username": "native_user",
            "password": "Str0ngPass!",
        },
    )
    assert register.status_code == 200, register.text
    token = register.json()["access_token"]
    assert token.count(".") == 2

    dup = client.post(
        "/api/v1/auth/register",
        json={
            "email": "native-user@example.com",
            "username": "other_user",
            "password": "Str0ngPass!",
        },
    )
    assert dup.status_code == 409

    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "native-user@example.com", "password": "wrong"},
    )
    assert bad_login.status_code == 401
    assert bad_login.json()["detail"] == "Invalid credentials"

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "native-user@example.com", "password": "Str0ngPass!"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    profile = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert profile.status_code == 200
    body = profile.json()
    assert body["email"] == "native-user@example.com"
    assert body["username"] == "native_user"

    change = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Str0ngPass!", "new_password": "N3wStr0ng!"},
    )
    assert change.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "native-user@example.com", "password": "Str0ngPass!"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "native-user@example.com", "password": "N3wStr0ng!"},
    )
    assert new_login.status_code == 200


def test_weak_password_rejected(client) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak@example.com",
            "username": "weak_user",
            "password": "short",
        },
    )
    assert response.status_code in {400, 422}


def test_auth_config(client) -> None:
    response = client.get("/api/v1/auth/config")
    assert response.status_code == 200
    data = response.json()
    assert data["native_enabled"] is True
