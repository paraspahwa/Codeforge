from __future__ import annotations

import os

from celery import Celery


BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", BROKER_URL)

celery_app = Celery("codeforge", broker=BROKER_URL, backend=RESULT_BACKEND)


@celery_app.task(name="app.celery_worker.noop_task")
def noop_task(source: str = "system") -> dict[str, str]:
    return {"status": "ok", "source": source}
