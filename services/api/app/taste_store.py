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


def insert_taste_event(event: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO taste_events(
            event_id, user_id, session_id, proposal_id, event_type, target_file,
            project_path, signal_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event["event_id"],
            event["user_id"],
            event["session_id"],
            event["proposal_id"],
            event["event_type"],
            event["target_file"],
            event.get("project_path"),
            _dumps(event.get("signal") or {}),
            event["created_at"],
        ),
    )


def list_taste_events_for_user(user_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT event_id, user_id, session_id, proposal_id, event_type, target_file,
               project_path, signal_json, created_at
        FROM taste_events
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (user_id, limit),
    )
    return [
        {
            **row,
            "signal": _loads(row.get("signal_json"), {}),
        }
        for row in rows
    ]


def count_taste_events_by_type(user_id: str) -> dict[str, int]:
    rows = _fetchall(
        """
        SELECT event_type, COUNT(*) AS total
        FROM taste_events
        WHERE user_id = ?
        GROUP BY event_type
        """,
        (user_id,),
    )
    return {row["event_type"]: int(row["total"]) for row in rows}


def count_distinct_sessions_with_events(user_id: str) -> int:
    row = _fetchone(
        """
        SELECT COUNT(DISTINCT session_id) AS total
        FROM taste_events
        WHERE user_id = ?
        """,
        (user_id,),
    )
    return int(row["total"]) if row else 0


def get_taste_rule_by_text(user_id: str, rule_text: str) -> dict[str, Any] | None:
    return _fetchone(
        """
        SELECT rule_id, user_id, scope, project_path, rule_text, weight, source_event_id,
               created_at, updated_at
        FROM taste_rules
        WHERE user_id = ? AND rule_text = ?
        """,
        (user_id, rule_text),
    )


def insert_taste_rule(rule: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO taste_rules(
            rule_id, user_id, scope, project_path, rule_text, weight,
            source_event_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            rule["rule_id"],
            rule["user_id"],
            rule.get("scope") or "user",
            rule.get("project_path"),
            rule["rule_text"],
            int(rule.get("weight") or 1),
            rule.get("source_event_id"),
            rule["created_at"],
            rule["updated_at"],
        ),
    )


def update_taste_rule_weight(rule_id: str, *, weight: int, updated_at: str) -> None:
    _execute(
        """
        UPDATE taste_rules
        SET weight = ?, updated_at = ?
        WHERE rule_id = ?
        """,
        (weight, updated_at, rule_id),
    )


def list_taste_rules_for_user(
    user_id: str,
    *,
    project_path: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    if project_path:
        rows = _fetchall(
            """
            SELECT rule_id, user_id, scope, project_path, rule_text, weight,
                   source_event_id, created_at, updated_at
            FROM taste_rules
            WHERE user_id = ? AND (scope = 'user' OR project_path = ?)
            ORDER BY weight DESC, updated_at DESC
            LIMIT ?
            """,
            (user_id, project_path, limit),
        )
    else:
        rows = _fetchall(
            """
            SELECT rule_id, user_id, scope, project_path, rule_text, weight,
                   source_event_id, created_at, updated_at
            FROM taste_rules
            WHERE user_id = ?
            ORDER BY weight DESC, updated_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
    return list(rows)


def count_taste_rules_for_user(user_id: str) -> int:
    row = _fetchone(
        "SELECT COUNT(*) AS total FROM taste_rules WHERE user_id = ?",
        (user_id,),
    )
    return int(row["total"]) if row else 0


def delete_lowest_weight_rules(user_id: str, *, keep: int) -> None:
    _execute(
        """
        DELETE FROM taste_rules
        WHERE rule_id IN (
            SELECT rule_id FROM taste_rules
            WHERE user_id = ?
            ORDER BY weight ASC, updated_at ASC
            LIMIT MAX(0, (SELECT COUNT(*) FROM taste_rules WHERE user_id = ?) - ?)
        )
        """,
        (user_id, user_id, keep),
    )

