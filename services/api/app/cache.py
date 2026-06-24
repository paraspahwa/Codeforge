from __future__ import annotations

import logging
import os
from threading import Lock
from time import monotonic
from typing import Any

logger = logging.getLogger(__name__)


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

            self._client = redis.Redis.from_url(
                self._url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            self._client.ping()
            self._backend = "redis"
        except ImportError:
            self._client = None
            self._backend = "memory"
            logger.info("redis not available, using in-memory cache")
        except Exception as exc:
            self._client = None
            self._backend = "memory"
            logger.warning("redis connection failed: %s", exc)

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
            except Exception as exc:
                logger.warning("redis get(%r) failed: %s", key, exc)

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
            except Exception as exc:
                logger.warning("redis set(%r) failed: %s", key, exc)

        with self._lock:
            self._memory[key] = value

    def delete(self, key: str) -> None:
        if self._client is not None:
            try:
                self._client.delete(key)
                return
            except Exception as exc:
                logger.warning("redis delete(%r) failed: %s", key, exc)

        with self._lock:
            self._memory.pop(key, None)

    def incrbyfloat(self, key: str, amount: float) -> float:
        if self._client is not None:
            try:
                result = self._client.incrbyfloat(key, amount)
                return float(result)
            except Exception as exc:
                logger.warning("redis incrbyfloat(%r) failed: %s", key, exc)

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
            except Exception as exc:
                logger.warning("redis incr_with_ttl(%r) failed: %s", key, exc)

        with self._lock:
            now = monotonic()
            entry = self._memory.get(key)
            if isinstance(entry, tuple) and entry[1] > now:
                count = entry[0] + 1
            else:
                count = 1
            self._memory[key] = (count, now + ttl_seconds)
            return count
