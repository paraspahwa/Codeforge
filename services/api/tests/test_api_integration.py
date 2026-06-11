from __future__ import annotations

from pathlib import Path

from app.db import init_db


def test_health_endpoint(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_dev_login_session_and_usage_summary(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "demo"
    project.mkdir()

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "integration-user"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    assert created.status_code == 200
    session_id = created.json()["session_id"]
    assert session_id.startswith("sess_")
    assert "/stream" in created.json()["stream_url"]

    usage = client.get("/api/v1/usage/summary", headers=headers)
    assert usage.status_code == 200
    payload = usage.json()
    assert payload["plan_id"] == "free"
    assert payload["request_limit"] == 100
    assert payload["requests_used_in_period"] == 0
    assert "billing_period_start" in payload


def test_agent_loop_endpoint(client, tmp_path: Path, monkeypatch) -> None:
    init_db()
    project = tmp_path / "loop-demo"
    project.mkdir()
    (project / "main.py").write_text("def run():\n    pass\n", encoding="utf-8")

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "loop-api-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    session_id = created.json()["session_id"]

    async def fake_verify(_project_path: str, _command: str, timeout_seconds: int = 30, **kwargs):
        _ = timeout_seconds, kwargs
        return {
            "command": _command,
            "exit_code": 0,
            "passed": True,
            "summary": "ok",
            "output": "ok",
            "timed_out": False,
        }

    monkeypatch.setattr("app.agent_loop.run_shell_command", fake_verify)

    response = client.post(
        f"/api/v1/sessions/{session_id}/agent/loop",
        headers=headers,
        json={"verify_command": "echo ok", "max_attempts": 2, "auto_apply": True},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["passed"] is True
    assert body["session_id"] == session_id


def test_list_proposals_endpoint(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "proposal-demo"
    project.mkdir()

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "proposal-list-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    session_id = created.json()["session_id"]

    response = client.get(f"/api/v1/sessions/{session_id}/proposals", headers=headers)
    assert response.status_code == 200
    assert response.json() == []
