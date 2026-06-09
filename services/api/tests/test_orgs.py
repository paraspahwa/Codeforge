from __future__ import annotations

from pathlib import Path

from app.db import init_db


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_list_and_link_organization(client, tmp_path: Path) -> None:
    init_db()
    project = tmp_path / "org-workspace"
    project.mkdir()

    owner_headers = _auth_headers(client, "org-owner")
    created = client.post(
        "/api/v1/orgs",
        headers=owner_headers,
        json={"name": "Startup Org", "plan_id": "team"},
    )
    assert created.status_code == 200
    org_id = created.json()["org_id"]
    assert created.json()["plan_id"] == "team"
    assert any(member["user_id"] == "org-owner" for member in created.json()["members"])

    listed = client.get("/api/v1/orgs", headers=owner_headers)
    assert listed.status_code == 200
    assert any(item["org_id"] == org_id for item in listed.json()["organizations"])

    member = client.post(
        f"/api/v1/orgs/{org_id}/members",
        headers=owner_headers,
        json={"user_id": "org-admin", "role": "admin"},
    )
    assert member.status_code == 200
    assert any(entry["user_id"] == "org-admin" for entry in member.json()["members"])

    workspace = client.post(
        "/api/v1/team/workspaces",
        headers=owner_headers,
        json={"name": "Org workspace", "description": ""},
    )
    assert workspace.status_code == 200
    workspace_id = workspace.json()["workspace_id"]

    linked = client.post(
        f"/api/v1/team/workspaces/{workspace_id}/org",
        headers=owner_headers,
        json={"org_id": org_id},
    )
    assert linked.status_code == 200
    assert linked.json()["org_id"] == org_id


def test_org_member_add_rejects_non_admin(client) -> None:
    init_db()
    owner_headers = _auth_headers(client, "owner-a")
    created = client.post(
        "/api/v1/orgs",
        headers=owner_headers,
        json={"name": "Locked Org", "plan_id": "pro"},
    )
    org_id = created.json()["org_id"]

    viewer_headers = _auth_headers(client, "viewer-a")
    denied = client.post(
        f"/api/v1/orgs/{org_id}/members",
        headers=viewer_headers,
        json={"user_id": "new-user", "role": "member"},
    )
    assert denied.status_code == 400
