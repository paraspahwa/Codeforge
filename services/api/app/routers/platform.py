from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthUser, get_current_user_optional
from ..state import generation_client, redis_session_store, task_queue, vector_store

router = APIRouter(tags=["platform"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/v1/platform/stack-status")
def platform_stack_status(user: AuthUser | None = Depends(get_current_user_optional)) -> dict[str, object]:
    _ = user
    return {
        "status": "ok",
        "redis": {
            "backend": redis_session_store.backend,
            "healthy": redis_session_store.ping(),
        },
        "vector_store": {
            "backend": vector_store.backend,
            "healthy": vector_store.ping(),
            "embedding_source": vector_store.embedding_source,
        },
        "task_queue": {
            "backend": task_queue.backend,
            "healthy": task_queue.health(),
        },
        "generation": {
            "backend": generation_client.backend,
        },
    }


@router.post("/api/v1/platform/queue-ping")
def platform_queue_ping(user: AuthUser | None = Depends(get_current_user_optional)) -> dict[str, object]:
    _ = user
    return task_queue.enqueue("app.celery_worker.noop_task", {"source": "api"})
