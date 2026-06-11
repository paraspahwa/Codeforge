from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import AuthUser, get_current_user
from ..models import (
    AgentPreferencesResponse,
    AgentPreferencesUpdateRequest,
    SkillDetailResponse,
    SkillListItem,
    SkillListResponse,
)
from ..skills_service import VALID_CAVEMAN_MODES, skills_service

router = APIRouter(tags=["skills"])


@router.get("/api/v1/skills", response_model=SkillListResponse)
def list_skills(
    user: AuthUser = Depends(get_current_user),
    project_path: str | None = Query(default=None),
) -> SkillListResponse:
    rows = skills_service.list_skills(project_path)
    return SkillListResponse(
        skills=[SkillListItem(**row) for row in rows],
        bundled_root=str(skills_service.bundled_skills_root()),
    )


@router.get("/api/v1/skills/{skill_name}", response_model=SkillDetailResponse)
def get_skill(
    skill_name: str,
    user: AuthUser = Depends(get_current_user),
    project_path: str | None = Query(default=None),
) -> SkillDetailResponse:
    _ = user
    skill = skills_service.load_skill(skill_name, project_path)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return SkillDetailResponse(
        name=skill["name"],
        description=skill.get("description", ""),
        origin=skill.get("origin", "bundled"),
        path=skill.get("path", ""),
        source=skill.get("source"),
        license=skill.get("license"),
        body=skill.get("body", ""),
    )


@router.get("/api/v1/agent/preferences", response_model=AgentPreferencesResponse)
def get_agent_preferences(user: AuthUser = Depends(get_current_user)) -> AgentPreferencesResponse:
    prefs = skills_service.get_preferences(user.user_id)
    return AgentPreferencesResponse(
        user_id=prefs["user_id"],
        caveman_mode=prefs["caveman_mode"],
        enabled_skills=prefs["enabled_skills"],
        available_caveman_modes=sorted(VALID_CAVEMAN_MODES),
        token_saver_enabled=prefs["caveman_mode"] != "off",
        rtk_enabled=bool(prefs.get("rtk_enabled")),
        rtk_last_stats=prefs.get("rtk_last_stats") or {},
    )


@router.put("/api/v1/agent/preferences", response_model=AgentPreferencesResponse)
def update_agent_preferences(
    payload: AgentPreferencesUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> AgentPreferencesResponse:
    try:
        skills_service.update_preferences(
            user_id=user.user_id,
            caveman_mode=payload.caveman_mode,
            enabled_skills=payload.enabled_skills,
            rtk_enabled=payload.rtk_enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    prefs = skills_service.get_preferences(user.user_id)
    return AgentPreferencesResponse(
        user_id=prefs["user_id"],
        caveman_mode=prefs["caveman_mode"],
        enabled_skills=prefs["enabled_skills"],
        available_caveman_modes=sorted(VALID_CAVEMAN_MODES),
        token_saver_enabled=prefs["caveman_mode"] != "off",
        rtk_enabled=bool(prefs.get("rtk_enabled")),
        rtk_last_stats=prefs.get("rtk_last_stats") or {},
    )
