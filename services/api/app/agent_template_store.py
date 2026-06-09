from __future__ import annotations

from typing import Any

from .db import _execute, _fetchall, _fetchone


def save_template(template: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO agent_templates(
            template_id, user_id, name, description, prompt_prefix, verify_command, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            template["template_id"],
            template["user_id"],
            template["name"],
            template["description"],
            template["prompt_prefix"],
            template.get("verify_command"),
            template["created_at"],
        ),
    )


def list_templates_for_user(user_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT template_id, user_id, name, description, prompt_prefix, verify_command, created_at
        FROM agent_templates
        WHERE user_id = ?
        ORDER BY created_at DESC
        """,
        (user_id,),
    )
    return [_template_row(row) for row in rows]


def get_template(template_id: str, user_id: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT template_id, user_id, name, description, prompt_prefix, verify_command, created_at
        FROM agent_templates
        WHERE template_id = ? AND user_id = ?
        """,
        (template_id, user_id),
    )
    return _template_row(row) if row else None


def delete_template(template_id: str, user_id: str) -> bool:
    before = get_template(template_id, user_id)
    if before is None:
        return False
    _execute(
        "DELETE FROM agent_templates WHERE template_id = ? AND user_id = ?",
        (template_id, user_id),
    )
    return True


def _template_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "template_id": row["template_id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "description": row["description"],
        "prompt_prefix": row["prompt_prefix"],
        "verify_command": row.get("verify_command"),
        "created_at": row["created_at"],
    }
