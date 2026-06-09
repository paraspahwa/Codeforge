from __future__ import annotations

import os

from celery import Celery
from celery.signals import worker_process_init


BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", BROKER_URL)
COWORK_TICK_SECONDS = max(2, int(os.getenv("CODEFORGE_COWORK_TICK_SECONDS", "2")))

celery_app = Celery("codeforge", broker=BROKER_URL, backend=RESULT_BACKEND)
celery_app.conf.beat_schedule = {
    "cowork-scheduler-tick": {
        "task": "app.celery_worker.tick_cowork_jobs",
        "schedule": float(COWORK_TICK_SECONDS),
    },
}


@worker_process_init.connect
def init_worker_process(**_kwargs) -> None:
    from app.db import init_db

    init_db()


@celery_app.task(name="app.celery_worker.noop_task")
def noop_task(source: str = "system") -> dict[str, str]:
    return {"status": "ok", "source": source}


@celery_app.task(name="app.celery_worker.tick_cowork_jobs")
def tick_cowork_jobs() -> dict[str, str]:
    from app.cowork_scheduler import run_scheduler_tick

    return run_scheduler_tick()
