from __future__ import annotations

import asyncio
import secrets
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from . import remote_channel_store


class RemoteChannelError(RuntimeError):
    pass


_event_queues: dict[str, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_channel(*, owner_id: str, label: str) -> dict[str, Any]:
    channel = {
        "channel_id": f"rch_{uuid4().hex[:10]}",
        "owner_id": owner_id,
        "label": label.strip() or "Remote client",
        "pairing_code": secrets.token_hex(4).upper(),
        "paired_client_id": None,
        "created_at": _utc_now(),
    }
    remote_channel_store.save_channel(channel)
    return channel


def list_channels(*, owner_id: str) -> list[dict[str, Any]]:
    return remote_channel_store.list_channels_for_owner(owner_id)


def pair_channel(*, pairing_code: str, client_id: str) -> dict[str, Any]:
    channel = remote_channel_store.get_channel_by_pairing_code(pairing_code.strip().upper())
    if channel is None:
        raise RemoteChannelError("Invalid pairing code")
    paired = remote_channel_store.pair_channel(channel["channel_id"], client_id.strip())
    if paired is None:
        raise RemoteChannelError("Channel not found")
    push_event(channel_id=paired["channel_id"], event_type="remote.paired", payload={"client_id": client_id})
    return paired


def subscribe(channel_id: str) -> asyncio.Queue[dict[str, Any]]:
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=64)
    _event_queues[channel_id].append(queue)
    return queue


def unsubscribe(channel_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
    _event_queues[channel_id] = [item for item in _event_queues.get(channel_id, []) if item is not queue]


def push_event(*, channel_id: str, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    channel = remote_channel_store.get_channel(channel_id)
    if channel is None:
        raise RemoteChannelError("Channel not found")

    event = {
        "type": event_type,
        "payload": payload,
        "channel_id": channel_id,
        "created_at": _utc_now(),
    }
    for queue in list(_event_queues.get(channel_id, [])):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            pass
    return event


def get_channel_for_user(*, channel_id: str, user_id: str) -> dict[str, Any]:
    channel = remote_channel_store.get_channel(channel_id)
    if channel is None:
        raise RemoteChannelError("Channel not found")
    if channel["owner_id"] != user_id and channel.get("paired_client_id") != user_id:
        raise RemoteChannelError("Not authorized for this channel")
    return channel
