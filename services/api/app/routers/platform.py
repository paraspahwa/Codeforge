from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..auth import AuthUser, get_current_user_optional
from ..agent_reach_service import probe_channel_status
from ..deploy_readiness import (
    collect_deploy_readiness,
    probe_billing_webhook,
    probe_oidc_discovery,
    probe_vector_store,
    public_api_webhook_url,
)
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


@router.get("/api/v1/platform/agent-reach/status")
async def platform_agent_reach_status(
    user: AuthUser | None = Depends(get_current_user_optional),
) -> dict[str, object]:
    _ = user
    return await probe_channel_status()


@router.post("/api/v1/platform/queue-ping")
def platform_queue_ping(user: AuthUser | None = Depends(get_current_user_optional)) -> dict[str, object]:
    _ = user
    return task_queue.enqueue("app.celery_worker.noop_task", {"source": "api"})


@router.get("/api/v1/platform/queue-ping/{job_id}")
def platform_queue_ping_status(job_id: str, user: AuthUser | None = Depends(get_current_user_optional)) -> dict[str, object]:
    _ = user
    return task_queue.get_job_status(job_id)


@router.get("/api/v1/platform/deploy-readiness")
async def platform_deploy_readiness(
    probe_discovery: bool = Query(default=False),
    probe_billing: bool = Query(default=False),
    probe_vector: bool = Query(default=False),
    user: AuthUser | None = Depends(get_current_user_optional),
) -> dict[str, object]:
    _ = user
    payload = collect_deploy_readiness()
    webhook_url = public_api_webhook_url()
    if webhook_url:
        payload["billing_webhook_url"] = webhook_url

    if probe_discovery:
        payload["oidc_discovery"] = await probe_oidc_discovery()
        if payload["oidc_enabled"] and not payload["oidc_discovery"].get("ok", False):
            payload["ready"] = False

    if probe_billing:
        payload["billing_webhook"] = probe_billing_webhook()
        if payload.get("environment") == "production" and not payload["billing_webhook"].get("ok", False):
            payload["ready"] = False

    if probe_vector:
        payload["vector_store"] = probe_vector_store()
        if payload.get("environment") == "production" and not payload["vector_store"].get("ok", False):
            payload["ready"] = False

    return payload
