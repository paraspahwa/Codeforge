from __future__ import annotations

import json
import time
from threading import Lock
from typing import Any

_STATE_TTL_SECONDS = 600
_STATE_KEY_PREFIX = "oidc_state:"
_state_store: dict[str, dict[str, Any]] = {}
_lock = Lock()


def _purge_expired(now: float) -> None:
    expired = [key for key, value in _state_store.items() if value["expires_at"] <= now]
    for key in expired:
        _state_store.pop(key, None)


def _redis_store():
    from .state import redis_session_store

    return redis_session_store


def register_oidc_state(state: str, *, redirect_uri: str) -> None:
    store = _redis_store()
    if store.backend == "redis":
        payload = json.dumps({"redirect_uri": redirect_uri})
        store.set(f"{_STATE_KEY_PREFIX}{state}", payload, ttl_seconds=_STATE_TTL_SECONDS)
        return

    now = time.time()
    with _lock:
        _purge_expired(now)
        _state_store[state] = {
            "redirect_uri": redirect_uri,
            "expires_at": now + _STATE_TTL_SECONDS,
        }


def consume_oidc_state(state: str, *, redirect_uri: str) -> bool:
    store = _redis_store()
    if store.backend == "redis":
        key = f"{_STATE_KEY_PREFIX}{state}"
        raw = store.get(key)
        store.delete(key)
        if not raw:
            return False
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            return False
        return entry.get("redirect_uri") == redirect_uri

    now = time.time()
    with _lock:
        _purge_expired(now)
        entry = _state_store.pop(state, None)
        if entry is None:
            return False
        if entry["expires_at"] <= now:
            return False
        return entry["redirect_uri"] == redirect_uri
