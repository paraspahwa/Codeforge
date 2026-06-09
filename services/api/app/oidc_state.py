from __future__ import annotations

import time
from threading import Lock
from typing import Any

_STATE_TTL_SECONDS = 600
_state_store: dict[str, dict[str, Any]] = {}
_lock = Lock()


def _purge_expired(now: float) -> None:
    expired = [key for key, value in _state_store.items() if value["expires_at"] <= now]
    for key in expired:
        _state_store.pop(key, None)


def register_oidc_state(state: str, *, redirect_uri: str) -> None:
    now = time.time()
    with _lock:
        _purge_expired(now)
        _state_store[state] = {
            "redirect_uri": redirect_uri,
            "expires_at": now + _STATE_TTL_SECONDS,
        }


def consume_oidc_state(state: str, *, redirect_uri: str) -> bool:
    now = time.time()
    with _lock:
        _purge_expired(now)
        entry = _state_store.pop(state, None)
        if entry is None:
            return False
        if entry["expires_at"] <= now:
            return False
        return entry["redirect_uri"] == redirect_uri
