from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .db import _execute, _fetchall


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def record_audit_event(
    *,
    actor_id: str,
    event_type: str,
    resource_type: str,
    resource_id: str,
    workspace_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    event = {
        "event_id": f"audit_{uuid4().hex[:12]}",
        "actor_id": actor_id,
        "event_type": event_type,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "workspace_id": workspace_id,
        "session_id": session_id,
        "metadata": metadata or {},
        "created_at": _utc_now(),
    }
    _execute(
        """
        INSERT INTO audit_logs(
            event_id, actor_id, event_type, resource_type, resource_id,
            workspace_id, session_id, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event["event_id"],
            event["actor_id"],
            event["event_type"],
            event["resource_type"],
            event["resource_id"],
            event["workspace_id"],
            event["session_id"],
            json.dumps(event["metadata"]),
            event["created_at"],
        ),
    )
    try:
        from . import team_event_bus
        from .projects_team_store import list_workspace_members

        recipients = [actor_id]
        if workspace_id:
            recipients.extend(member["user_id"] for member in list_workspace_members(workspace_id))
        team_event_bus.publish(
            recipients,
            "team.audit",
            {
                "event_id": event["event_id"],
                "event_type": event_type,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "workspace_id": workspace_id,
                "session_id": session_id,
            },
        )
    except Exception:
        pass
    return event


def list_audit_events_for_user(
    *,
    user_id: str,
    workspace_ids: set[str],
    session_ids: set[str],
    workspace_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 200))
    clauses = ["actor_id = ?"]
    params: list[Any] = [user_id]

    if workspace_ids:
        placeholders = ", ".join("?" for _ in workspace_ids)
        clauses.append(f"(workspace_id IS NOT NULL AND workspace_id IN ({placeholders}))")
        params.extend(sorted(workspace_ids))

    if session_ids:
        placeholders = ", ".join("?" for _ in session_ids)
        clauses.append(f"(session_id IS NOT NULL AND session_id IN ({placeholders}))")
        params.extend(sorted(session_ids))

    if workspace_id:
        if workspace_id not in workspace_ids:
            return []
        clauses = ["workspace_id = ?"]
        params = [workspace_id]

    where = " OR ".join(f"({clause})" for clause in clauses) if len(clauses) > 1 else clauses[0]
    rows = _fetchall(
        f"""
        SELECT event_id, actor_id, event_type, resource_type, resource_id,
               workspace_id, session_id, metadata_json, created_at
        FROM audit_logs
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT ?
        """,
        tuple([*params, limit]),
    )

    events: list[dict[str, Any]] = []
    for row in rows:
        metadata = {}
        try:
            metadata = json.loads(row.get("metadata_json") or "{}")
        except json.JSONDecodeError:
            metadata = {}
        events.append(
            {
                "event_id": row["event_id"],
                "actor_id": row["actor_id"],
                "event_type": row["event_type"],
                "resource_type": row["resource_type"],
                "resource_id": row["resource_id"],
                "workspace_id": row.get("workspace_id"),
                "session_id": row.get("session_id"),
                "metadata": metadata,
                "created_at": row["created_at"],
            }
        )
    return events
