from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .db import _execute, _fetchone


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_account(*, email: str, username: str, password_hash: str) -> dict[str, Any]:
    user_id = f"usr_{uuid4().hex[:16]}"
    now = _utc_now_iso()
    _execute(
        """
        INSERT INTO user_accounts (user_id, email, username, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_id, email.lower(), username.lower(), password_hash, now, now),
    )
    return get_account_by_id(user_id) or {}


def get_account_by_id(user_id: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT user_id, email, username, password_hash, created_at, updated_at
        FROM user_accounts
        WHERE user_id = ?
        """,
        (user_id,),
    )
    return row


def get_account_by_email(email: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT user_id, email, username, password_hash, created_at, updated_at
        FROM user_accounts
        WHERE email = ?
        """,
        (email.lower(),),
    )
    return row


def get_account_by_username(username: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT user_id, email, username, password_hash, created_at, updated_at
        FROM user_accounts
        WHERE username = ?
        """,
        (username.lower(),),
    )
    return row


def update_password_hash(user_id: str, password_hash: str) -> None:
    _execute(
        """
        UPDATE user_accounts
        SET password_hash = ?, updated_at = ?
        WHERE user_id = ?
        """,
        (password_hash, _utc_now_iso(), user_id),
    )
