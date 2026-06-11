from __future__ import annotations

from app.db import init_db
from app import rtk_service


def test_rtk_supported_commands() -> None:
    assert rtk_service.is_rtk_supported_command("git status")
    assert rtk_service.is_rtk_supported_command("pytest services/api/tests")
    assert rtk_service.is_rtk_supported_command("npm test")
    assert not rtk_service.is_rtk_supported_command("echo hello")


def test_rtk_summary_prefers_full_filtered_output() -> None:
    output = "FAILED tests/test_x.py::test_y - AssertionError"
    summary = rtk_service.build_shell_summary(output, 1, rtk_applied=True)
    assert summary == output
    tail_summary = rtk_service.build_shell_summary("x" * 2000, 1, rtk_applied=False)
    assert len(tail_summary) == 1200


def test_rtk_preferences_and_status(client, monkeypatch) -> None:
    init_db()
    monkeypatch.setenv("CODEFORGE_RTK_ENABLED", "true")

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "rtk-user"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    update = client.put(
        "/api/v1/agent/preferences",
        headers=headers,
        json={"rtk_enabled": True},
    )
    assert update.status_code == 200
    assert update.json()["rtk_enabled"] is True

    status = client.get("/api/v1/rtk/status", headers=headers)
    assert status.status_code == 200
    body = status.json()
    assert "binary_available" in body
    assert body["env_enabled"] is True
