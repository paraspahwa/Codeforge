from __future__ import annotations

from pathlib import Path

from app import audit_store
from app.db import init_db


def _auth_headers(client) -> tuple[str, dict[str, str]]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "audit-user"})
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


def test_team_actions_emit_audit_log(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "audit-team"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=headers,
        json={"name": "Audit Team", "description": "Enterprise workspace"},
    )
    assert workspace.status_code == 200
    workspace_id = workspace.json()["workspace_id"]

    member = client.post(
        f"/api/v1/team/workspaces/{workspace_id}/members",
        headers=headers,
        json={"user_id": "audit-member", "role": "viewer"},
    )
    assert member.status_code == 200

    share = client.post(
        "/api/v1/team/session-share",
        headers=headers,
        json={"session_id": session_id, "access_level": "view", "expires_in_hours": 12},
    )
    assert share.status_code == 200
    share_id = share.json()["share_id"]

    resolved = client.get(f"/api/v1/team/session-share/{share_id}", headers=headers)
    assert resolved.status_code == 200

    delegation = client.post(
        "/api/v1/team/delegations",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "session_id": session_id,
            "assigned_role": "reviewer",
            "task": "Check uploaded docs",
            "priority": "high",
        },
    )
    assert delegation.status_code == 200

    audit = client.get("/api/v1/team/audit-log", headers=headers)
    assert audit.status_code == 200
    event_types = {entry["event_type"] for entry in audit.json()["events"]}
    assert "team.workspace_created" in event_types
    assert "team.workspace_member_added" in event_types
    assert "team.session_share_created" in event_types
    assert "team.session_share_resolved" in event_types
    assert "team.delegation_created" in event_types

    filtered = client.get(f"/api/v1/team/audit-log?workspace_id={workspace_id}", headers=headers)
    assert filtered.status_code == 200
    assert all(
        entry.get("workspace_id") in {None, workspace_id}
        for entry in filtered.json()["events"]
    )


def test_knowledge_upload_indexes_and_audits(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "upload-knowledge"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    upload = client.post(
        "/api/v1/projects/knowledge/upload",
        headers=headers,
        data={"session_id": session_id},
        files=[("files", ("notes.md", b"Uploaded billing policy for enterprise customers", "text/markdown"))],
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["uploaded_paths"]
    assert any("notes.md" in path for path in body["uploaded_paths"])

    query = client.post(
        "/api/v1/projects/knowledge/query",
        headers=headers,
        json={"session_id": session_id, "query": "billing", "limit": 3},
    )
    assert query.status_code == 200
    assert query.json()["results"]

    events = audit_store.list_audit_events_for_user(
        user_id="audit-user",
        workspace_ids=set(),
        session_ids={session_id},
        workspace_id=None,
        limit=20,
    )
    assert any(event["event_type"] == "projects.knowledge_uploaded" for event in events)
