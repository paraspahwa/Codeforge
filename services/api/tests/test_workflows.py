from __future__ import annotations

from pathlib import Path

from app.db import init_db


def test_compact_and_ultrareview_workflows(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "workflow-demo"
    project.mkdir()
    (project / "main.py").write_text("def run():\n    pass\n", encoding="utf-8")

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "workflow-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    session_id = created.json()["session_id"]

    compact = client.post(f"/api/v1/sessions/{session_id}/workflows/compact", headers=headers)
    assert compact.status_code == 200
    compact_body = compact.json()
    assert compact_body["session_id"] == session_id
    assert "Continuation prompt" in compact_body["summary"]

    review = client.post(f"/api/v1/sessions/{session_id}/workflows/ultrareview", headers=headers, json={})
    assert review.status_code == 200
    review_body = review.json()
    assert review_body["risk_level"] in {"low", "medium", "high"}
    assert review_body["report"]


def test_plan_create_and_rollback(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "plan-demo"
    project.mkdir()
    target = project / "main.py"
    target.write_text("def run():\n    pass\n", encoding="utf-8")

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "plan-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    session_id = created.json()["session_id"]

    plan = client.post(
        f"/api/v1/sessions/{session_id}/workflows/plan",
        headers=headers,
        json={"targets": ["main.py"]},
    )
    assert plan.status_code == 200
    plan_id = plan.json()["plan_id"]

    rollback = client.post(
        f"/api/v1/sessions/{session_id}/workflows/plan/{plan_id}/rollback",
        headers=headers,
    )
    assert rollback.status_code == 200
    assert rollback.json()["plan_id"] == plan_id


def test_fork_session(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "fork-demo"
    project.mkdir()

    login = client.post("/api/v1/auth/dev-login", json={"user_id": "fork-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    parent_id = created.json()["session_id"]

    forked = client.post(f"/api/v1/sessions/{parent_id}/fork", headers=headers)
    assert forked.status_code == 200
    body = forked.json()
    assert body["parent_session_id"] == parent_id
    assert body["session_id"] != parent_id
