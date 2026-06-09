from __future__ import annotations

import os
from threading import Lock
from time import monotonic
from typing import Any


class RedisSessionStore:
    """Redis-backed session counters with in-memory fallback for local/dev resilience."""

    def __init__(self) -> None:
        self._url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._memory: dict[str, Any] = {}
        self._lock = Lock()
        self._client = None
        self._backend = "memory"

        try:
            import redis  # type: ignore

            self._client = redis.Redis.from_url(self._url, decode_responses=True)
            self._backend = "redis"
        except Exception:
            self._client = None
            self._backend = "memory"

    @property
    def backend(self) -> str:
        return self._backend

    def ping(self) -> bool:
        if self._client is None:
            return True
        try:
            return bool(self._client.ping())
        except Exception:
            return False

    def get(self, key: str, default: Any = None) -> Any:
        if self._client is not None:
            try:
                value = self._client.get(key)
                return default if value is None else value
            except Exception:
                pass

        with self._lock:
            return self._memory.get(key, default)

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        if self._client is not None:
            try:
                if ttl_seconds:
                    self._client.setex(key, ttl_seconds, value)
                else:
                    self._client.set(key, value)
                return
            except Exception:
                pass

        with self._lock:
            self._memory[key] = value

    def incrbyfloat(self, key: str, amount: float) -> float:
        if self._client is not None:
            try:
                result = self._client.incrbyfloat(key, amount)
                return float(result)
            except Exception:
                pass

        with self._lock:
            current = float(self._memory.get(key, 0.0))
            current += amount
            self._memory[key] = current
            return current

    def incr_with_ttl(self, key: str, ttl_seconds: int) -> int:
        if self._client is not None:
            try:
                count = int(self._client.incr(key))
                if count == 1:
                    self._client.expire(key, ttl_seconds)
                return count
            except Exception:
                pass

        with self._lock:
            now = monotonic()
            entry = self._memory.get(key)
            if isinstance(entry, tuple) and entry[1] > now:
                count = entry[0] + 1
            else:
                count = 1
            self._memory[key] = (count, now + ttl_seconds)
            return count
