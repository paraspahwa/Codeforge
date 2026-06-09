from __future__ import annotations

from pathlib import Path

from app.db import init_db


def _auth_headers(client) -> tuple[str, dict[str, str]]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "cowork-user"})
    token = login.json()["access_token"]
    return token, {"Authorization": f"Bearer {token}"}


def _create_session(client, headers: dict[str, str], project: Path) -> str:
    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    assert created.status_code == 200
    return created.json()["session_id"]


def test_cowork_shell_plan_preview_and_run(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "cowork-shell"
    project.mkdir()
    (project / "notes.txt").write_text("hello cowork", encoding="utf-8")

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    plan = client.post(
        "/api/v1/cowork/plans",
        headers=headers,
        json={
            "session_id": session_id,
            "title": "List files",
            "task_type": "shell",
            "command": "dir" if Path.cwd().drive else "ls",
        },
    )
    assert plan.status_code == 200
    body = plan.json()
    assert body["requires_approval"] is False
    assert body["preview_steps"]

    run = client.post(
        f"/api/v1/cowork/plans/{body['plan_id']}/run",
        headers=headers,
        json={"approved": False},
    )
    assert run.status_code == 200
    assert run.json()["status"] in {"completed", "failed"}


def test_cowork_browser_requires_manual_approval(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "cowork-browser"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    plan = client.post(
        "/api/v1/cowork/plans",
        headers=headers,
        json={
            "session_id": session_id,
            "title": "Fetch page",
            "task_type": "browser",
            "url": "https://example.com",
            "browser_action": "capture_title",
        },
    )
    assert plan.status_code == 200
    plan_body = plan.json()
    assert plan_body["requires_approval"] is True

    blocked = client.post(
        f"/api/v1/cowork/plans/{plan_body['plan_id']}/run",
        headers=headers,
        json={"approved": False},
    )
    assert blocked.status_code == 400

    approved = client.post(
        f"/api/v1/cowork/plans/{plan_body['plan_id']}/run",
        headers=headers,
        json={"approved": True},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "completed"


def test_cowork_browser_url_validation(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "cowork-url"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    invalid = client.post(
        "/api/v1/cowork/plans",
        headers=headers,
        json={
            "session_id": session_id,
            "title": "Bad URL",
            "task_type": "browser",
            "url": "file:///etc/passwd",
        },
    )
    assert invalid.status_code == 400


def test_cowork_extraction_pipeline(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "cowork-extract"
    project.mkdir()
    source = project / "contact.txt"
    source.write_text("Email: user@example.com\nPhone: 9876543210\n", encoding="utf-8")

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    extraction = client.post(
        "/api/v1/cowork/extract",
        headers=headers,
        json={"session_id": session_id, "source_path": "contact.txt"},
    )
    assert extraction.status_code == 200
    body = extraction.json()
    assert body["method"] == "plain_text"
    assert any(item.get("type") == "email" for item in body["entities"])

    listed = client.get("/api/v1/cowork/extract", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["extractions"]) >= 1


def test_cowork_jobs_reject_browser_tasks(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "cowork-jobs"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    rejected = client.post(
        "/api/v1/cowork/jobs",
        headers=headers,
        json={
            "session_id": session_id,
            "title": "Bad browser job",
            "trigger_type": "interval",
            "interval_seconds": 30,
            "task_type": "browser",
            "url": "https://example.com",
        },
    )
    assert rejected.status_code == 422 or rejected.status_code == 400


def test_cowork_shell_job_can_be_created(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "cowork-job-shell"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    job = client.post(
        "/api/v1/cowork/jobs",
        headers=headers,
        json={
            "session_id": session_id,
            "title": "Periodic list",
            "trigger_type": "interval",
            "interval_seconds": 30,
            "task_type": "shell",
            "command": "echo cowork",
        },
    )
    assert job.status_code == 200
    assert job.json()["enabled"] is True


def test_cowork_connector_task_boundary(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "cowork-connector"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    connector = client.post(
        "/api/v1/mcp/connectors",
        headers=headers,
        json={
            "name": "Cowork stub",
            "description": "Test connector",
            "endpoint": "local://stub",
            "transport": "stdio",
            "tools": ["ping"],
        },
    )
    assert connector.status_code == 200
    connector_id = connector.json()["connector_id"]

    plan = client.post(
        "/api/v1/cowork/plans",
        headers=headers,
        json={
            "session_id": session_id,
            "title": "Ping connector",
            "task_type": "connector",
            "connector_id": connector_id,
            "tool_name": "ping",
            "connector_arguments": {"source": "cowork-test"},
        },
    )
    assert plan.status_code == 200
    plan_body = plan.json()
    assert plan_body["requires_approval"] is True

    blocked = client.post(
        f"/api/v1/cowork/plans/{plan_body['plan_id']}/run",
        headers=headers,
        json={"approved": False},
    )
    assert blocked.status_code == 400

    approved = client.post(
        f"/api/v1/cowork/plans/{plan_body['plan_id']}/run",
        headers=headers,
        json={"approved": True},
    )
    assert approved.status_code == 200
    run_body = approved.json()
    assert run_body["status"] == "completed"
    assert run_body["details"]["invocation"]["tool_name"] == "ping"


def test_cowork_reliability_snapshot(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "cowork-reliability"
    project.mkdir()

    _, headers = _auth_headers(client)
    _create_session(client, headers, project)

    snapshot = client.get("/api/v1/cowork/reliability", headers=headers)
    assert snapshot.status_code == 200
    body = snapshot.json()
    assert "recent_failure_rate" in body
    assert "max_concurrent_runs" in body
