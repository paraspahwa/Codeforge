from __future__ import annotations

import asyncio
import os

from .cowork import cowork_service
from .db import init_db

_db_initialized = False


def cowork_scheduler_enabled() -> bool:
    explicit = os.getenv("CODEFORGE_COWORK_SCHEDULER_ENABLED")
    if explicit is not None:
        return explicit.strip().lower() in {"1", "true", "yes", "on"}
    return os.getenv("CODEFORGE_ENV", "development").strip().lower() != "production"


def _ensure_db() -> None:
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True


def run_scheduler_tick() -> dict[str, str]:
    _ensure_db()
    asyncio.run(cowork_service.tick_scheduled_jobs())
    return {"status": "ok"}
