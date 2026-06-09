from __future__ import annotations

from typing import Any

from .db import _execute, _fetchall, _fetchone


def save_channel(channel: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO remote_channels(
            channel_id, owner_id, label, pairing_code, paired_client_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            channel["channel_id"],
            channel["owner_id"],
            channel["label"],
            channel["pairing_code"],
            channel.get("paired_client_id"),
            channel["created_at"],
        ),
    )


def list_channels_for_owner(owner_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT channel_id, owner_id, label, pairing_code, paired_client_id, created_at
        FROM remote_channels
        WHERE owner_id = ?
        ORDER BY created_at DESC
        """,
        (owner_id,),
    )
    return [_row(row) for row in rows]


def get_channel(channel_id: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT channel_id, owner_id, label, pairing_code, paired_client_id, created_at
        FROM remote_channels
        WHERE channel_id = ?
        """,
        (channel_id,),
    )
    return _row(row) if row else None


def get_channel_by_pairing_code(pairing_code: str) -> dict[str, Any] | None:
    row = _fetchone(
        """
        SELECT channel_id, owner_id, label, pairing_code, paired_client_id, created_at
        FROM remote_channels
        WHERE pairing_code = ?
        """,
        (pairing_code,),
    )
    return _row(row) if row else None


def pair_channel(channel_id: str, paired_client_id: str) -> dict[str, Any] | None:
    channel = get_channel(channel_id)
    if channel is None:
        return None
    _execute(
        "UPDATE remote_channels SET paired_client_id = ? WHERE channel_id = ?",
        (paired_client_id, channel_id),
    )
    channel["paired_client_id"] = paired_client_id
    return channel


def _row(row: Any) -> dict[str, Any]:
    return {
        "channel_id": row["channel_id"],
        "owner_id": row["owner_id"],
        "label": row["label"],
        "pairing_code": row["pairing_code"],
        "paired_client_id": row["paired_client_id"],
        "created_at": row["created_at"],
    }
