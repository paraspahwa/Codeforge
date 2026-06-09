from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

_subscribers: dict[str, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)


def subscribe(user_id: str) -> asyncio.Queue[dict[str, Any]]:
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=64)
    _subscribers[user_id].append(queue)
    return queue


def unsubscribe(user_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
    _subscribers[user_id] = [item for item in _subscribers.get(user_id, []) if item is not queue]


def publish(user_ids: list[str], event_type: str, payload: dict[str, Any]) -> None:
    event = {
        "type": event_type,
        "payload": payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    for user_id in {item for item in user_ids if item}:
        for queue in list(_subscribers.get(user_id, [])):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass
