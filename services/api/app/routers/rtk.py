from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthUser, get_current_user
from ..models import RtkStatusResponse
from .. import rtk_service
from ..skills_service import skills_service

router = APIRouter(tags=["rtk"])


@router.get("/api/v1/rtk/status", response_model=RtkStatusResponse)
def rtk_status(user: AuthUser = Depends(get_current_user)) -> RtkStatusResponse:
    prefs = skills_service.get_preferences(user.user_id)
    binary = rtk_service.rtk_binary_path()
    env_enabled = rtk_service.env_rtk_enabled()
    user_enabled = bool(prefs.get("rtk_enabled"))
    effective = user_enabled or env_enabled
    return RtkStatusResponse(
        binary_available=bool(binary),
        binary_path=binary,
        env_enabled=env_enabled,
        user_enabled=user_enabled,
        effective_enabled=bool(effective and binary),
        last_stats=prefs.get("rtk_last_stats") or {},
    )
