from __future__ import annotations

import os
from typing import Any
from uuid import uuid4


class TaskQueue:
    """Celery-first queue abstraction with inline fallback for local/dev."""

    def __init__(self) -> None:
        self._broker = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
        self._backend_url = os.getenv("CELERY_RESULT_BACKEND", self._broker)
        self._celery_app = None
        self._backend = "inline"

        try:
            from celery import Celery  # type: ignore

            self._celery_app = Celery("codeforge", broker=self._broker, backend=self._backend_url)
            self._backend = "celery"
        except Exception:
            self._celery_app = None
            self._backend = "inline"

    @property
    def backend(self) -> str:
        return self._backend

    def health(self) -> bool:
        if self._celery_app is None:
            return True
        try:
            inspect_result = self._celery_app.control.inspect(timeout=1)
            _ = inspect_result.ping() if inspect_result else None
            return True
        except Exception:
            return False

    def enqueue(self, task_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        if self._celery_app is not None:
            try:
                # Dispatch as a generic task envelope to keep queue integration non-breaking.
                result = self._celery_app.send_task(task_name, kwargs=payload)
                return {
                    "job_id": result.id,
                    "backend": "celery",
                    "status": "queued",
                }
            except Exception:
                pass

        return {
            "job_id": f"inline_{uuid4().hex[:12]}",
            "backend": "inline",
            "status": "accepted",
            "task_name": task_name,
            "payload": payload,
        }

    def get_job_status(self, job_id: str) -> dict[str, Any]:
        if self._celery_app is None or not job_id:
            return {"job_id": job_id, "backend": "inline", "status": "unknown"}

        try:
            from celery.result import AsyncResult

            result = AsyncResult(job_id, app=self._celery_app)
            state = result.state or "PENDING"
            payload: dict[str, Any] = {
                "job_id": job_id,
                "backend": "celery",
                "status": state.lower(),
            }
            if result.successful():
                payload["result"] = result.result
            elif result.failed():
                payload["error"] = str(result.result)
            return payload
        except Exception as exc:
            return {
                "job_id": job_id,
                "backend": "celery",
                "status": "error",
                "error": str(exc),
            }
