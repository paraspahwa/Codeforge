from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthUser, get_current_user
from .. import hermes_adapter
from ..models import HermesStatusResponse
from ..skills_service import skills_service

router = APIRouter(tags=["hermes"])


@router.get("/api/v1/hermes/status", response_model=HermesStatusResponse)
def hermes_status(user: AuthUser = Depends(get_current_user)) -> HermesStatusResponse:
    prefs = skills_service.get_preferences(user.user_id)
    env_enabled = hermes_adapter.env_hermes_enabled()
    user_engine = hermes_adapter.resolve_agent_engine(prefs)
    binary = hermes_adapter.hermes_binary_path()
    simulate = hermes_adapter.hermes_simulate_enabled()
    runtime_available = hermes_adapter.hermes_runtime_available()
    effective_engine = user_engine if runtime_available or user_engine == "codeforge" else "codeforge"

    return HermesStatusResponse(
        env_enabled=env_enabled,
        binary_available=bool(binary),
        binary_path=binary,
        simulate_mode=simulate,
        hermes_home=hermes_adapter.hermes_home(),
        user_engine=prefs.get("agent_engine") or "codeforge",
        effective_engine=effective_engine,
        runtime_available=runtime_available,
        available_engines=sorted(hermes_adapter.VALID_AGENT_ENGINES),
    )
