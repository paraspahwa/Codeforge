from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

from .db import insert_permission_audit


VALID_MODES = ("ask", "auto_safe", "auto_all")


def default_permission_mode() -> str:
    mode = os.getenv("CODEFORGE_PERMISSION_MODE", "auto_safe").strip().lower()
    return mode if mode in VALID_MODES else "auto_safe"


def record_permission_event(
    *,
    user_id: str,
    session_id: str,
    tool: str,
    action: str,
    granted: bool,
    note: str | None = None,
) -> None:
    insert_permission_audit(
        audit_id=f"perm_{uuid4().hex[:12]}",
        user_id=user_id,
        session_id=session_id,
        tool=tool,
        action=action,
        granted=granted,
        note=note,
    )


def shell_allowed(command: str, mode: str) -> bool:
    if mode == "auto_all":
        return True
    if mode == "ask":
        return False
    return True
