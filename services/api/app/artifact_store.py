from __future__ import annotations

import json
from typing import Any

from .db import _execute, _fetchall, _fetchone


def save_artifact(artifact: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO session_artifacts(
            artifact_id, session_id, user_id, title, kind, content, source_message_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            artifact["artifact_id"],
            artifact["session_id"],
            artifact["user_id"],
            artifact["title"],
            artifact["kind"],
            artifact["content"],
            artifact.get("source_message_id"),
            artifact["created_at"],
        ),
    )


def list_artifacts_for_session(session_id: str, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 200))
    rows = _fetchall(
        """
        SELECT artifact_id, session_id, user_id, title, kind, content, source_message_id, created_at
        FROM session_artifacts
        WHERE session_id = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (session_id, user_id, limit),
    )
    return [_artifact_row(row) for row in rows]


def get_artifact(artifact_id: str, user_id: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT artifact_id, session_id, user_id, title, kind, content, source_message_id, created_at
        FROM session_artifacts
        WHERE artifact_id = ? AND user_id = ?
        """,
        (artifact_id, user_id),
    )
    return _artifact_row(row) if row else None


def _artifact_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": row["artifact_id"],
        "session_id": row["session_id"],
        "user_id": row["user_id"],
        "title": row["title"],
        "kind": row["kind"],
        "content": row["content"],
        "source_message_id": row.get("source_message_id"),
        "created_at": row["created_at"],
    }
