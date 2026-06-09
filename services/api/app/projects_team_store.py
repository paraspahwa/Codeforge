from __future__ import annotations

import json
from typing import Any

from .db import _execute, _fetchall, _fetchone


def _loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def save_knowledge(state: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO project_knowledge(
            knowledge_id, session_id, user_id, title, project_path, summary, items_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            knowledge_id = excluded.knowledge_id,
            user_id = excluded.user_id,
            title = excluded.title,
            project_path = excluded.project_path,
            summary = excluded.summary,
            items_json = excluded.items_json,
            updated_at = excluded.updated_at
        """,
        (
            state["knowledge_id"],
            state["session_id"],
            state["user_id"],
            state["title"],
            state["project_path"],
            state["summary"],
            _dumps(state.get("items") or []),
            state["updated_at"],
        ),
    )


def get_knowledge_by_session(session_id: str) -> dict[str, Any] | None:
    row = _fetchone("SELECT * FROM project_knowledge WHERE session_id = ?", (session_id,))
    if not row:
        return None
    return {
        "knowledge_id": row["knowledge_id"],
        "session_id": row["session_id"],
        "user_id": row["user_id"],
        "title": row["title"],
        "project_path": row["project_path"],
        "summary": row["summary"],
        "items": _loads(row.get("items_json"), []),
        "updated_at": row["updated_at"],
    }


def save_workspace(workspace: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO team_workspaces(workspace_id, name, description, owner_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            workspace["workspace_id"],
            workspace["name"],
            workspace["description"],
            workspace["owner_id"],
            workspace["created_at"],
        ),
    )
    for member in workspace.get("members") or []:
        save_workspace_member(workspace["workspace_id"], member)


def get_workspace(workspace_id: str) -> dict[str, Any] | None:
    row = _fetchone("SELECT * FROM team_workspaces WHERE workspace_id = ?", (workspace_id,))
    if not row:
        return None
    members = list_workspace_members(workspace_id)
    return {
        "workspace_id": row["workspace_id"],
        "name": row["name"],
        "description": row["description"],
        "owner_id": row["owner_id"],
        "org_id": row.get("org_id"),
        "created_at": row["created_at"],
        "members": members,
    }


def list_workspaces_for_user(user_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT w.*
        FROM team_workspaces w
        INNER JOIN team_workspace_members m ON m.workspace_id = w.workspace_id
        WHERE m.user_id = ?
        ORDER BY w.created_at DESC
        """,
        (user_id,),
    )
    return [
        {
            "workspace_id": row["workspace_id"],
            "name": row["name"],
            "description": row["description"],
            "owner_id": row["owner_id"],
            "created_at": row["created_at"],
            "members": list_workspace_members(row["workspace_id"]),
        }
        for row in rows
    ]


def save_workspace_member(workspace_id: str, member: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO team_workspace_members(workspace_id, user_id, role, added_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(workspace_id, user_id) DO UPDATE SET
            role = excluded.role,
            added_at = excluded.added_at
        """,
        (
            workspace_id,
            member["user_id"],
            member["role"],
            member["added_at"],
        ),
    )


def list_workspace_members(workspace_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT user_id, role, added_at
        FROM team_workspace_members
        WHERE workspace_id = ?
        ORDER BY added_at ASC
        """,
        (workspace_id,),
    )
    return [
        {
            "user_id": row["user_id"],
            "role": row["role"],
            "added_at": row["added_at"],
        }
        for row in rows
    ]


def save_session_share(share: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO session_shares(
            share_id, session_id, owner_id, access_level, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            share["share_id"],
            share["session_id"],
            share["owner_id"],
            share["access_level"],
            share["created_at"],
            share["expires_at"],
        ),
    )


def save_workspace_session_grant(grant: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO workspace_session_grants(
            grant_id, workspace_id, session_id, granted_to_user_id, granted_by, access_level, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            grant["grant_id"],
            grant["workspace_id"],
            grant["session_id"],
            grant["granted_to_user_id"],
            grant["granted_by"],
            grant["access_level"],
            grant["created_at"],
        ),
    )


def has_workspace_session_grant(*, workspace_id: str, session_id: str, user_id: str) -> bool:
    row = _fetchone(
        """
        SELECT grant_id
        FROM workspace_session_grants
        WHERE workspace_id = ? AND session_id = ? AND granted_to_user_id = ?
        LIMIT 1
        """,
        (workspace_id, session_id, user_id),
    )
    return row is not None


def list_workspace_session_grants(workspace_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT grant_id, workspace_id, session_id, granted_to_user_id, granted_by, access_level, created_at
        FROM workspace_session_grants
        WHERE workspace_id = ?
        ORDER BY created_at DESC
        """,
        (workspace_id,),
    )
    return [dict(row) for row in rows]


def session_has_active_share(session_id: str) -> bool:
    row = _fetchone(
        """
        SELECT share_id
        FROM session_shares
        WHERE session_id = ?
          AND (expires_at IS NULL OR expires_at = '' OR expires_at > datetime('now'))
        LIMIT 1
        """,
        (session_id,),
    )
    return row is not None


def get_session_share(share_id: str) -> dict[str, Any] | None:
    row = _fetchone("SELECT * FROM session_shares WHERE share_id = ?", (share_id,))
    if not row:
        return None
    return {
        "share_id": row["share_id"],
        "session_id": row["session_id"],
        "owner_id": row["owner_id"],
        "access_level": row["access_level"],
        "created_at": row["created_at"],
        "expires_at": row["expires_at"],
    }


def save_delegation(delegation: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO team_delegations(
            task_id, workspace_id, session_id, requester_id, assigned_role, task,
            priority, status, note, created_at, completed_at,
            orchestration_mode, agent_roles_json, steps_json,
            require_step_approval, current_step_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            delegation["task_id"],
            delegation["workspace_id"],
            delegation["session_id"],
            delegation["requester_id"],
            delegation["assigned_role"],
            delegation["task"],
            delegation["priority"],
            delegation["status"],
            delegation.get("note") or "",
            delegation["created_at"],
            delegation.get("completed_at"),
            delegation.get("orchestration_mode") or "single",
            _dumps(delegation.get("agent_roles") or []),
            _dumps(delegation.get("steps") or []),
            1 if delegation.get("require_step_approval") else 0,
            int(delegation.get("current_step_index") or 0),
        ),
    )


def update_delegation(
    task_id: str,
    *,
    status: str,
    note: str,
    completed_at: str | None = None,
    steps: list[dict[str, Any]] | None = None,
    current_step_index: int | None = None,
) -> None:
    if steps is not None and current_step_index is not None:
        _execute(
            """
            UPDATE team_delegations
            SET status = ?, note = ?, completed_at = ?, steps_json = ?, current_step_index = ?
            WHERE task_id = ?
            """,
            (status, note, completed_at, _dumps(steps), current_step_index, task_id),
        )
        return
    if steps is not None:
        _execute(
            """
            UPDATE team_delegations
            SET status = ?, note = ?, completed_at = ?, steps_json = ?
            WHERE task_id = ?
            """,
            (status, note, completed_at, _dumps(steps), task_id),
        )
        return
    _execute(
        """
        UPDATE team_delegations
        SET status = ?, note = ?, completed_at = ?
        WHERE task_id = ?
        """,
        (status, note, completed_at, task_id),
    )


def get_delegation(task_id: str) -> dict[str, Any] | None:
    row = _fetchone("SELECT * FROM team_delegations WHERE task_id = ?", (task_id,))
    if not row:
        return None
    return _row_to_delegation(row)


def list_delegations_for_workspaces(workspace_ids: set[str], workspace_id: str | None = None) -> list[dict[str, Any]]:
    if not workspace_ids:
        return []
    placeholders = ", ".join("?" for _ in workspace_ids)
    params: list[Any] = list(workspace_ids)
    query = f"""
        SELECT * FROM team_delegations
        WHERE workspace_id IN ({placeholders})
    """
    if workspace_id:
        query += " AND workspace_id = ?"
        params.append(workspace_id)
    query += " ORDER BY created_at DESC"
    rows = _fetchall(query, tuple(params))
    return [_row_to_delegation(row) for row in rows]


def _row_to_delegation(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "task_id": row["task_id"],
        "workspace_id": row["workspace_id"],
        "session_id": row["session_id"],
        "requester_id": row["requester_id"],
        "assigned_role": row["assigned_role"],
        "task": row["task"],
        "priority": row["priority"],
        "status": row["status"],
        "note": row["note"] or "",
        "orchestration_mode": row.get("orchestration_mode") or "single",
        "agent_roles": _loads(row.get("agent_roles_json"), []),
        "steps": _loads(row.get("steps_json"), []),
        "require_step_approval": bool(row.get("require_step_approval")),
        "current_step_index": int(row.get("current_step_index") or 0),
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
    }


def save_style_guide(guide: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO team_style_guides(
            guide_id, workspace_id, title, guide_type, content, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            guide["guide_id"],
            guide["workspace_id"],
            guide["title"],
            guide["guide_type"],
            guide["content"],
            guide["updated_by"],
            guide["created_at"],
            guide["updated_at"],
        ),
    )


def update_style_guide(guide_id: str, *, title: str, guide_type: str, content: str, updated_by: str, updated_at: str) -> None:
    _execute(
        """
        UPDATE team_style_guides
        SET title = ?, guide_type = ?, content = ?, updated_by = ?, updated_at = ?
        WHERE guide_id = ?
        """,
        (title, guide_type, content, updated_by, updated_at, guide_id),
    )


def get_style_guide(guide_id: str) -> dict[str, Any] | None:
    row = _fetchone("SELECT * FROM team_style_guides WHERE guide_id = ?", (guide_id,))
    return _row_to_style_guide(row) if row else None


def list_style_guides_for_workspace(workspace_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT * FROM team_style_guides
        WHERE workspace_id = ?
        ORDER BY updated_at DESC
        """,
        (workspace_id,),
    )
    return [_row_to_style_guide(row) for row in rows]


def _row_to_style_guide(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "guide_id": row["guide_id"],
        "workspace_id": row["workspace_id"],
        "title": row["title"],
        "guide_type": row["guide_type"],
        "content": row["content"],
        "updated_by": row["updated_by"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
