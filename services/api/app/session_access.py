from __future__ import annotations

from typing import Any

from .db import get_session_by_id, get_session_for_user
from .projects_team_store import get_workspace, has_workspace_session_grant, session_has_active_share


def resolve_team_session(
    *,
    actor_id: str,
    session_id: str,
    workspace_id: str | None = None,
) -> dict[str, Any] | None:
    owned = get_session_for_user(session_id=session_id, user_id=actor_id)
    if owned is not None:
        return owned

    if not workspace_id:
        return None

    workspace = get_workspace(workspace_id)
    if workspace is None:
        return None

    if not any(member["user_id"] == actor_id for member in workspace.get("members", [])):
        return None

    owner_session = get_session_for_user(session_id=session_id, user_id=workspace["owner_id"])
    if owner_session is not None:
        return owner_session

    if has_workspace_session_grant(workspace_id=workspace_id, session_id=session_id, user_id=actor_id):
        session = get_session_by_id(session_id)
        if session is not None:
            return session

    if session_has_active_share(session_id):
        session = get_session_by_id(session_id)
        if session is None:
            return None
        owner_ids = {workspace["owner_id"], *(member["user_id"] for member in workspace.get("members", []))}
        if session["user_id"] in owner_ids:
            return session

    return None
