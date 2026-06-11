from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import AuthUser, get_current_user
from ..memory_service import memory_service
from ..models import (
    MemoryExportResponse,
    MemoryItem,
    MemoryListResponse,
    MemorySaveRequest,
    MemorySaveResponse,
    MemorySearchResponse,
    SupermemorySaveRequest,
    SupermemorySearchResponse,
    SupermemoryStatusResponse,
)
from .. import memory_store
from .. import supermemory_connector

router = APIRouter(tags=["memory"])


@router.get("/api/v1/memory", response_model=MemoryListResponse)
def list_memories(
    user: AuthUser = Depends(get_current_user),
    project_path: str | None = Query(default=None),
    scope: str | None = Query(default=None),
) -> MemoryListResponse:
    project_id = memory_service.project_id_from_path(project_path)
    rows = memory_store.list_memories_for_user(
        user.user_id,
        project_id=project_id if project_path else None,
        scope=scope,
        limit=50,
    )
    return MemoryListResponse(
        memories=[
            MemoryItem(
                memory_id=row["memory_id"],
                scope=row["scope"],
                kind=row["kind"],
                content=row["content"],
                project_id=row["project_id"],
                source_session_id=row.get("source_session_id"),
                created_at=datetime.fromisoformat(row["created_at"]),
            )
            for row in rows
        ]
    )


@router.get("/api/v1/memory/search", response_model=MemorySearchResponse)
def search_memory(
    q: str = Query(min_length=1),
    user: AuthUser = Depends(get_current_user),
    project_path: str | None = Query(default=None),
) -> MemorySearchResponse:
    native_hits = memory_service.search_memories(
        user_id=user.user_id,
        query=q,
        project_path=project_path,
        limit=5,
    )
    super_hits: list[dict] = []
    if supermemory_connector.is_configured(project_path):
        super_hits = supermemory_connector.search_memories(
            user_id=user.user_id,
            query=q,
            project_path=project_path,
            scope="both",
            limit=3,
        )

    return MemorySearchResponse(
        query=q,
        native=[
            MemoryItem(
                memory_id=hit["memory_id"],
                scope=hit["scope"],
                kind=hit["kind"],
                content=hit["content"],
                project_id=memory_service.project_id_from_path(project_path),
                source_session_id=None,
                created_at=datetime.now(),
            )
            for hit in native_hits
        ],
        supermemory=[{"memory": item["memory"], "container_tag": item["container_tag"]} for item in super_hits],
    )


@router.post("/api/v1/memory/save", response_model=MemorySaveResponse)
def save_memory(
    payload: MemorySaveRequest,
    user: AuthUser = Depends(get_current_user),
) -> MemorySaveResponse:
    try:
        row = memory_service.save_memory(
            user_id=user.user_id,
            content=payload.content,
            project_path=payload.project_path,
            scope=payload.scope,
            kind=payload.kind,
            source_session_id=payload.source_session_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MemorySaveResponse(
        memory_id=row["memory_id"],
        scope=row["scope"],
        kind=row["kind"],
        content=row["content"],
        created_at=datetime.fromisoformat(row["created_at"]),
    )


@router.get("/api/v1/memory/export", response_model=MemoryExportResponse)
def export_memory(user: AuthUser = Depends(get_current_user)) -> MemoryExportResponse:
    rows = memory_store.list_memories_for_user(user.user_id, limit=200)
    return MemoryExportResponse(
        version=1,
        user_id=user.user_id,
        memories=[
            {
                "scope": row["scope"],
                "kind": row["kind"],
                "content": row["content"],
                "project_id": row["project_id"],
                "source_session_id": row.get("source_session_id"),
                "created_at": row["created_at"],
            }
            for row in rows
        ],
    )


@router.get("/api/v1/supermemory/status", response_model=SupermemoryStatusResponse)
def supermemory_status(
    user: AuthUser = Depends(get_current_user),
    project_path: str | None = Query(default=None),
) -> SupermemoryStatusResponse:
    status = supermemory_connector.get_status(user_id=user.user_id, project_path=project_path)
    return SupermemoryStatusResponse(**status)


@router.get("/api/v1/supermemory/search", response_model=SupermemorySearchResponse)
def supermemory_search(
    q: str = Query(min_length=1),
    user: AuthUser = Depends(get_current_user),
    project_path: str | None = Query(default=None),
    scope: str = Query(default="both"),
) -> SupermemorySearchResponse:
    if not supermemory_connector.is_configured(project_path):
        raise HTTPException(status_code=501, detail="Supermemory API key is not configured")
    hits = supermemory_connector.search_memories(
        user_id=user.user_id,
        query=q,
        project_path=project_path,
        scope=scope,
        limit=10,
    )
    return SupermemorySearchResponse(
        query=q,
        results=[{"memory": item["memory"], "container_tag": item["container_tag"]} for item in hits],
    )


@router.post("/api/v1/supermemory/save")
def supermemory_save(
    payload: SupermemorySaveRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict:
    if not supermemory_connector.is_configured(payload.project_path):
        raise HTTPException(status_code=501, detail="Supermemory API key is not configured")
    try:
        result = supermemory_connector.save_memory(
            user_id=user.user_id,
            content=payload.content,
            project_path=payload.project_path,
            scope=payload.scope,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result
