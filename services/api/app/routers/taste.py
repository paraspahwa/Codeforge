from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends

from ..auth import AuthUser, get_current_user
from ..models import (
    TasteExportResponse,
    TasteImportRequest,
    TasteImportResponse,
    TasteRuleItem,
    TasteRulesResponse,
    TasteStatsResponse,
)
from .. import taste_store
from ..taste_service import taste_service

router = APIRouter(tags=["taste"])


@router.get("/api/v1/taste/rules", response_model=TasteRulesResponse)
def list_taste_rules(user: AuthUser = Depends(get_current_user)) -> TasteRulesResponse:
    stored = taste_store.list_taste_rules_for_user(user.user_id, limit=50)
    return TasteRulesResponse(
        rules=[
            TasteRuleItem(
                rule_id=row["rule_id"],
                rule_text=row["rule_text"],
                weight=int(row["weight"]),
                scope=str(row.get("scope") or "user"),
                project_path=row.get("project_path"),
                updated_at=datetime.fromisoformat(row["updated_at"]),
            )
            for row in stored
        ],
        taste_md=taste_service.render_taste_md(user.user_id),
    )


@router.get("/api/v1/taste/stats", response_model=TasteStatsResponse)
def taste_stats(user: AuthUser = Depends(get_current_user)) -> TasteStatsResponse:
    return TasteStatsResponse(**taste_service.get_stats(user.user_id))


@router.get("/api/v1/taste/export", response_model=TasteExportResponse)
def export_taste(user: AuthUser = Depends(get_current_user)) -> TasteExportResponse:
    pack = taste_service.export_pack(user.user_id)
    return TasteExportResponse(
        version=int(pack["version"]),
        exported_at=datetime.fromisoformat(pack["exported_at"]),
        user_id=pack["user_id"],
        rules=pack["rules"],
    )


@router.post("/api/v1/taste/import", response_model=TasteImportResponse)
def import_taste(
    payload: TasteImportRequest,
    user: AuthUser = Depends(get_current_user),
) -> TasteImportResponse:
    imported = taste_service.import_pack(user.user_id, payload.model_dump())
    stats = taste_service.get_stats(user.user_id)
    return TasteImportResponse(
        imported_rules=imported,
        active_rules=int(stats["active_rules"]),
    )
