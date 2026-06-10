from __future__ import annotations

from pathlib import Path

from app.db import init_db


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_session(client, headers: dict[str, str], project: Path) -> str:
    created = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"project_path": str(project), "model_preference": "auto"},
    )
    assert created.status_code == 200
    return created.json()["session_id"]


def test_workspace_session_grant_allows_delegation(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "grant-workspace"
    project.mkdir()

    owner_headers = _auth_headers(client, "grant-owner")
    owner_session_id = _create_session(client, owner_headers, project)

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=owner_headers,
        json={"name": "Grant team", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]

    for member_id in ("grant-member", "grant-outsider"):
        client.post(
            f"/api/v1/team/workspaces/{workspace_id}/members",
            headers=owner_headers,
            json={"user_id": member_id, "role": "member"},
        )

    member_headers = _auth_headers(client, "grant-member")
    member_session_id = _create_session(client, member_headers, project)

    grant = client.post(
        f"/api/v1/team/workspaces/{workspace_id}/session-grants",
        headers=owner_headers,
        json={
            "session_id": owner_session_id,
            "granted_to_user_id": "grant-member",
            "access_level": "delegate",
        },
    )
    assert grant.status_code == 200
    grant_id = grant.json()["grant_id"]

    listed = client.get(
        f"/api/v1/team/workspaces/{workspace_id}/session-grants",
        headers=member_headers,
    )
    assert listed.status_code == 200
    assert any(item["grant_id"] == grant_id for item in listed.json()["grants"])

    allowed = client.post(
        "/api/v1/team/delegations",
        headers=member_headers,
        json={
            "workspace_id": workspace_id,
            "session_id": owner_session_id,
            "assigned_role": "reviewer",
            "task": "Use granted owner session",
            "priority": "normal",
        },
    )
    assert allowed.status_code == 200

    outsider_headers = _auth_headers(client, "grant-outsider")
    denied = client.post(
        "/api/v1/team/delegations",
        headers=outsider_headers,
        json={
            "workspace_id": workspace_id,
            "session_id": member_session_id,
            "assigned_role": "reviewer",
            "task": "Should be denied",
            "priority": "normal",
        },
    )
    assert denied.status_code == 403


def test_session_grant_rejects_non_member(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "grant-deny"
    project.mkdir()

    owner_headers = _auth_headers(client, "grant-owner-2")
    owner_session_id = _create_session(client, owner_headers, project)

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=owner_headers,
        json={"name": "Grant deny", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]

    denied = client.post(
        f"/api/v1/team/workspaces/{workspace_id}/session-grants",
        headers=owner_headers,
        json={
            "session_id": owner_session_id,
            "granted_to_user_id": "not-a-member",
            "access_level": "delegate",
        },
    )
    assert denied.status_code == 400


def test_view_grant_allows_read_but_blocks_write(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "grant-access"
    project.mkdir()

    owner_headers = _auth_headers(client, "access-owner")
    owner_session_id = _create_session(client, owner_headers, project)

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=owner_headers,
        json={"name": "Access team", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]

    client.post(
        f"/api/v1/team/workspaces/{workspace_id}/members",
        headers=owner_headers,
        json={"user_id": "access-member", "role": "member"},
    )

    client.post(
        f"/api/v1/team/workspaces/{workspace_id}/session-grants",
        headers=owner_headers,
        json={
            "session_id": owner_session_id,
            "granted_to_user_id": "access-member",
            "access_level": "view",
        },
    )

    member_headers = _auth_headers(client, "access-member")
    listed = client.get(f"/api/v1/sessions/{owner_session_id}/messages", headers=member_headers)
    assert listed.status_code == 200

    denied = client.post(
        f"/api/v1/sessions/{owner_session_id}/messages",
        headers=member_headers,
        json={"content": "Should be blocked"},
    )
    assert denied.status_code == 403


def test_delegate_grant_allows_post_message(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "grant-delegate-write"
    project.mkdir()

    owner_headers = _auth_headers(client, "delegate-owner")
    owner_session_id = _create_session(client, owner_headers, project)

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=owner_headers,
        json={"name": "Delegate write", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]

    client.post(
        f"/api/v1/team/workspaces/{workspace_id}/members",
        headers=owner_headers,
        json={"user_id": "delegate-member", "role": "member"},
    )

    client.post(
        f"/api/v1/team/workspaces/{workspace_id}/session-grants",
        headers=owner_headers,
        json={
            "session_id": owner_session_id,
            "granted_to_user_id": "delegate-member",
            "access_level": "delegate",
        },
    )

    member_headers = _auth_headers(client, "delegate-member")
    allowed = client.post(
        f"/api/v1/sessions/{owner_session_id}/messages",
        headers=member_headers,
        json={"content": "Granted delegate write"},
    )
    assert allowed.status_code == 200


def test_granted_session_appears_in_session_list(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "grant-list"
    project.mkdir()

    owner_headers = _auth_headers(client, "list-owner")
    owner_session_id = _create_session(client, owner_headers, project)

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=owner_headers,
        json={"name": "List team", "description": ""},
    )
    workspace_id = workspace.json()["workspace_id"]

    client.post(
        f"/api/v1/team/workspaces/{workspace_id}/members",
        headers=owner_headers,
        json={"user_id": "list-member", "role": "member"},
    )

    client.post(
        f"/api/v1/team/workspaces/{workspace_id}/session-grants",
        headers=owner_headers,
        json={
            "session_id": owner_session_id,
            "granted_to_user_id": "list-member",
            "access_level": "view",
        },
    )

    member_headers = _auth_headers(client, "list-member")
    listed = client.get("/api/v1/sessions", headers=member_headers)
    assert listed.status_code == 200
    items = listed.json()
    match = next((item for item in items if item["session_id"] == owner_session_id), None)
    assert match is not None
    assert match["access_source"] == "granted"
    assert match["access_level"] == "view"
    assert match["workspace_id"] == workspace_id
    assert match["owner_user_id"] == "list-owner"
