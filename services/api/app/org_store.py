from __future__ import annotations

from typing import Any

from .db import _execute, _fetchall, _fetchone


def save_organization(org: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO organizations(org_id, name, owner_id, plan_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (org["org_id"], org["name"], org["owner_id"], org["plan_id"], org["created_at"]),
    )


def save_organization_member(org_id: str, member: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO organization_members(org_id, user_id, role, added_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(org_id, user_id) DO UPDATE SET
            role = excluded.role,
            added_at = excluded.added_at
        """,
        (org_id, member["user_id"], member["role"], member["added_at"]),
    )


def get_organization(org_id: str) -> dict[str, Any] | None:
    row = _fetchone("SELECT * FROM organizations WHERE org_id = ?", (org_id,))
    if not row:
        return None
    members = list_organization_members(org_id)
    return {
        "org_id": row["org_id"],
        "name": row["name"],
        "owner_id": row["owner_id"],
        "plan_id": row["plan_id"],
        "created_at": row["created_at"],
        "members": members,
    }


def list_organization_members(org_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        "SELECT user_id, role, added_at FROM organization_members WHERE org_id = ? ORDER BY added_at ASC",
        (org_id,),
    )
    return [{"user_id": row["user_id"], "role": row["role"], "added_at": row["added_at"]} for row in rows]


def list_organizations_for_user(user_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT o.org_id, o.name, o.owner_id, o.plan_id, o.created_at
        FROM organizations o
        LEFT JOIN organization_members m ON m.org_id = o.org_id
        WHERE o.owner_id = ? OR m.user_id = ?
        GROUP BY o.org_id, o.name, o.owner_id, o.plan_id, o.created_at
        ORDER BY o.created_at DESC
        """,
        (user_id, user_id),
    )
    return [
        {
            "org_id": row["org_id"],
            "name": row["name"],
            "owner_id": row["owner_id"],
            "plan_id": row["plan_id"],
            "created_at": row["created_at"],
            "members": list_organization_members(row["org_id"]),
        }
        for row in rows
    ]


def best_plan_for_user(user_id: str) -> str | None:
    rows = _fetchall(
        """
        SELECT o.plan_id
        FROM organizations o
        LEFT JOIN organization_members m ON m.org_id = o.org_id
        WHERE o.owner_id = ? OR m.user_id = ?
        """,
        (user_id, user_id),
    )
    priority = {"team": 3, "pro": 2, "lite": 1, "free": 0}
    best = None
    best_score = -1
    for row in rows:
        plan_id = str(row["plan_id"])
        score = priority.get(plan_id, 0)
        if score > best_score:
            best = plan_id
            best_score = score
    return best


def set_workspace_org(workspace_id: str, org_id: str | None) -> None:
    _execute("UPDATE team_workspaces SET org_id = ? WHERE workspace_id = ?", (org_id, workspace_id))


def update_organization_plan(org_id: str, plan_id: str) -> None:
    _execute("UPDATE organizations SET plan_id = ? WHERE org_id = ?", (plan_id, org_id))


def downgrade_owned_organizations(user_id: str, plan_id: str = "lite") -> list[str]:
    owned = list_owned_organizations(user_id)
    for org in owned:
        update_organization_plan(org["org_id"], plan_id)
    return [org["org_id"] for org in owned]


def list_owned_organizations(user_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT org_id, name, owner_id, plan_id, created_at
        FROM organizations
        WHERE owner_id = ?
        ORDER BY created_at DESC
        """,
        (user_id,),
    )
    return [
        {
            "org_id": row["org_id"],
            "name": row["name"],
            "owner_id": row["owner_id"],
            "plan_id": row["plan_id"],
            "created_at": row["created_at"],
            "members": list_organization_members(row["org_id"]),
        }
        for row in rows
    ]
