from __future__ import annotations

from pathlib import Path

from app import projects_team_store as store
from app.db import init_db


def _auth_headers(client) -> tuple[str, dict[str, str]]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "team-user"})
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


def test_project_knowledge_rebuild_and_query_persists(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "team-knowledge"
    project.mkdir()
    (project / "README.md").write_text("Authentication middleware for billing routes", encoding="utf-8")

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    rebuild = client.post(
        "/api/v1/projects/knowledge/rebuild",
        headers=headers,
        json={"session_id": session_id, "title": "Team KB"},
    )
    assert rebuild.status_code == 200
    body = rebuild.json()
    assert body["items"]
    knowledge_id = body["knowledge_id"]

    loaded = store.get_knowledge_by_session(session_id)
    assert loaded is not None
    assert loaded["knowledge_id"] == knowledge_id

    query = client.post(
        "/api/v1/projects/knowledge/query",
        headers=headers,
        json={"session_id": session_id, "query": "billing", "limit": 3},
    )
    assert query.status_code == 200
    assert query.json()["results"]


def test_team_workspace_members_and_delegation_persist(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "team-workspace"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=headers,
        json={"name": "Startup", "description": "Core team"},
    )
    assert workspace.status_code == 200
    workspace_id = workspace.json()["workspace_id"]

    member = client.post(
        f"/api/v1/team/workspaces/{workspace_id}/members",
        headers=headers,
        json={"user_id": "reviewer-user", "role": "member"},
    )
    assert member.status_code == 200
    assert any(entry["user_id"] == "reviewer-user" for entry in member.json()["members"])

    loaded_workspace = store.get_workspace(workspace_id)
    assert loaded_workspace is not None
    assert len(loaded_workspace["members"]) >= 2

    delegation = client.post(
        "/api/v1/team/delegations",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "session_id": session_id,
            "assigned_role": "reviewer",
            "task": "Summarize project README",
            "priority": "normal",
        },
    )
    assert delegation.status_code == 200
    task_id = delegation.json()["task_id"]
    assert delegation.json()["status"] == "queued"

    listed = client.get("/api/v1/team/delegations", headers=headers)
    assert listed.status_code == 200
    assert any(item["task_id"] == task_id for item in listed.json()["delegations"])

    stored = store.get_delegation(task_id)
    assert stored is not None
    assert stored["workspace_id"] == workspace_id


def test_session_share_resolve_and_web_url(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "team-share"
    project.mkdir()

    _, headers = _auth_headers(client)
    session_id = _create_session(client, headers, project)

    share = client.post(
        "/api/v1/team/session-share",
        headers=headers,
        json={"session_id": session_id, "access_level": "view", "expires_in_hours": 24},
    )
    assert share.status_code == 200
    body = share.json()
    assert body["share_url"].endswith(f"/share/{body['share_id']}")

    stored = store.get_session_share(body["share_id"])
    assert stored is not None
    assert stored["session_id"] == session_id

    resolved = client.get(f"/api/v1/team/session-share/{body['share_id']}", headers=headers)
    assert resolved.status_code == 200
    assert resolved.json()["session_id"] == session_id
    assert resolved.json()["project_path"]
