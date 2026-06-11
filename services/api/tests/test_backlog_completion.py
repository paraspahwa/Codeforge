from __future__ import annotations

import base64
import json
import os

from app.db import init_db


def _fake_id_token(subject: str) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": subject}).encode()).decode().rstrip("=")
    return f"{header}.{payload}.sig"


def test_oidc_exchange_when_enabled(client, monkeypatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_OIDC_ENABLED", "true")
    monkeypatch.setenv("CODEFORGE_OIDC_TRUST_SUBJECT", "true")

    response = client.post(
        "/api/v1/auth/oidc/exchange",
        json={"id_token": _fake_id_token("enterprise-user"), "subject": "enterprise-user"},
    )
    assert response.status_code == 200
    assert response.json()["access_token"].startswith("oidc_")


def test_team_events_stream_connected(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "team-stream-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/team/events?probe=true", headers=headers)
    assert response.status_code == 200
    assert "connected" in response.text


def test_remote_channel_pair_and_push(client) -> None:
    init_db()
    owner_login = client.post("/api/v1/auth/dev-login", json={"user_id": "remote-owner"})
    owner_token = owner_login.json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    created = client.post(
        "/api/v1/remote/channels",
        headers=owner_headers,
        json={"label": "Mobile client"},
    )
    assert created.status_code == 200
    channel = created.json()
    pairing_code = channel["pairing_code"]

    client_login = client.post("/api/v1/auth/dev-login", json={"user_id": "mobile-client"})
    client_token = client_login.json()["access_token"]
    client_headers = {"Authorization": f"Bearer {client_token}"}

    paired = client.post(
        "/api/v1/remote/channels/pair",
        headers=client_headers,
        json={"pairing_code": pairing_code, "client_id": "mobile-client"},
    )
    assert paired.status_code == 200

    pushed = client.post(
        f"/api/v1/remote/channels/{channel['channel_id']}/push",
        headers=owner_headers,
        json={"event_type": "terminal.command", "payload": {"message": "hello"}},
    )
    assert pushed.status_code == 200
    assert pushed.json()["status"] == "queued"


def test_workspace_rate_limit_keyed(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "rate-limit-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/team/workspaces",
        headers=headers,
        json={"name": "Rate limit workspace", "description": "test"},
    )
    assert created.status_code == 200
    workspace_id = created.json()["workspace_id"]

    for index in range(3):
        response = client.post(
            f"/api/v1/team/workspaces/{workspace_id}/members",
            headers=headers,
            json={"user_id": f"member-{index}", "role": "member"},
        )
        assert response.status_code == 200
