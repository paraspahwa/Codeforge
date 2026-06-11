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


def insert_agent_memory(row: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO agent_memories(
            memory_id, user_id, project_id, scope, kind, content, content_hash,
            source_session_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            row["memory_id"],
            row["user_id"],
            row["project_id"],
            row["scope"],
            row["kind"],
            row["content"],
            row["content_hash"],
            row.get("source_session_id"),
            row["created_at"],
        ),
    )


def get_memory_by_hash(user_id: str, content_hash: str) -> dict[str, Any] | None:
    return _fetchone(
        """
        SELECT * FROM agent_memories
        WHERE user_id = ? AND content_hash = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (user_id, content_hash),
    )


def list_memories_for_user(
    user_id: str,
    *,
    project_id: str | None = None,
    scope: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    clauses = ["user_id = ?"]
    params: list[Any] = [user_id]
    if project_id:
        clauses.append("project_id = ?")
        params.append(project_id)
    if scope:
        clauses.append("scope = ?")
        params.append(scope)
    params.append(max(1, min(limit, 200)))
    where = " AND ".join(clauses)
    return _fetchall(
        f"""
        SELECT memory_id, user_id, project_id, scope, kind, content, content_hash,
               source_session_id, created_at
        FROM agent_memories
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT ?
        """,
        tuple(params),
    )


def search_memories_keyword(
    user_id: str,
    query: str,
    *,
    project_id: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    tokens = [token for token in query.strip().lower().split() if len(token) >= 2]
    if not tokens:
        return []
    clauses = ["user_id = ?"]
    params: list[Any] = [user_id]
    for token in tokens:
        clauses.append("LOWER(content) LIKE ?")
        params.append(f"%{token}%")
    if project_id:
        clauses.append("project_id = ?")
        params.append(project_id)
    params.append(max(1, min(limit, 20)))
    where = " AND ".join(clauses)
    rows = _fetchall(
        f"""
        SELECT memory_id, user_id, project_id, scope, kind, content, content_hash,
               source_session_id, created_at
        FROM agent_memories
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT ?
        """,
        tuple(params),
    )
    return rows
