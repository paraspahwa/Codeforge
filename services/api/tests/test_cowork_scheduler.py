from __future__ import annotations

from pathlib import Path

from app.cowork_scheduler import cowork_scheduler_enabled, run_scheduler_tick
from app.db import init_db


def test_cowork_scheduler_enabled_explicit_false(monkeypatch) -> None:
    monkeypatch.setenv("CODEFORGE_COWORK_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("CODEFORGE_ENV", "development")
    assert cowork_scheduler_enabled() is False


def test_cowork_scheduler_enabled_defaults_off_in_production(monkeypatch) -> None:
    monkeypatch.delenv("CODEFORGE_COWORK_SCHEDULER_ENABLED", raising=False)
    monkeypatch.setenv("CODEFORGE_ENV", "production")
    assert cowork_scheduler_enabled() is False


def test_cowork_scheduler_enabled_defaults_on_in_development(monkeypatch) -> None:
    monkeypatch.delenv("CODEFORGE_COWORK_SCHEDULER_ENABLED", raising=False)
    monkeypatch.setenv("CODEFORGE_ENV", "development")
    assert cowork_scheduler_enabled() is True


def test_run_scheduler_tick_executes_file_change_job(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "scheduler-project"
    project.mkdir()
    marker = project / "tick.txt"
    marker.write_text("v1", encoding="utf-8")

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "scheduler-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    session_id = created.json()["session_id"]

    job = client.post(
        "/api/v1/cowork/jobs",
        headers=headers,
        json={
            "session_id": session_id,
            "title": "File change shell",
            "trigger_type": "file_change",
            "interval_seconds": 30,
            "watch_path": "tick.txt",
            "task_type": "shell",
            "command": "dir" if Path.cwd().drive else "ls",
        },
    )
    assert job.status_code == 200

    marker.write_text("v2", encoding="utf-8")
    result = run_scheduler_tick()
    assert result["status"] == "ok"

    runs = client.get("/api/v1/cowork/runs", headers=headers)
    assert runs.status_code == 200
    assert len(runs.json()["runs"]) >= 1
