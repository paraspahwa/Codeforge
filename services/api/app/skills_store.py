from __future__ import annotations

import json
from typing import Any

from .db import _execute, _fetchone


def _loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def get_user_agent_preferences(user_id: str) -> dict[str, Any]:
    row = _fetchone(
        """
        SELECT user_id, caveman_mode, enabled_skills_json, rtk_enabled, rtk_last_stats_json, updated_at
        FROM user_agent_preferences
        WHERE user_id = ?
        """,
        (user_id,),
    )
    if not row:
        return {
            "user_id": user_id,
            "caveman_mode": "off",
            "enabled_skills": [],
            "rtk_enabled": False,
            "rtk_last_stats": {},
            "updated_at": None,
        }
    return {
        "user_id": row["user_id"],
        "caveman_mode": row["caveman_mode"],
        "enabled_skills": _loads(row.get("enabled_skills_json"), []),
        "rtk_enabled": bool(row.get("rtk_enabled")),
        "rtk_last_stats": _loads(row.get("rtk_last_stats_json"), {}),
        "updated_at": row["updated_at"],
    }


def upsert_user_agent_preferences(
    *,
    user_id: str,
    caveman_mode: str,
    enabled_skills: list[str],
    updated_at: str,
    rtk_enabled: bool | None = None,
    rtk_last_stats: dict[str, Any] | None = None,
) -> None:
    current = get_user_agent_preferences(user_id)
    resolved_rtk_enabled = current["rtk_enabled"] if rtk_enabled is None else rtk_enabled
    resolved_rtk_stats = current["rtk_last_stats"] if rtk_last_stats is None else rtk_last_stats
    _execute(
        """
        INSERT INTO user_agent_preferences(
            user_id, caveman_mode, enabled_skills_json, rtk_enabled, rtk_last_stats_json, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            caveman_mode = excluded.caveman_mode,
            enabled_skills_json = excluded.enabled_skills_json,
            rtk_enabled = excluded.rtk_enabled,
            rtk_last_stats_json = excluded.rtk_last_stats_json,
            updated_at = excluded.updated_at
        """,
        (
            user_id,
            caveman_mode,
            _dumps(enabled_skills),
            1 if resolved_rtk_enabled else 0,
            _dumps(resolved_rtk_stats),
            updated_at,
        ),
    )
