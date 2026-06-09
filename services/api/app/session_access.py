from __future__ import annotations

from typing import Any

from .db import get_session_by_id, get_session_for_user
from .projects_team_store import (
    get_active_session_share_access_level,
    get_workspace,
    has_workspace_session_grant,
    list_session_grants_for_actor,
    session_has_active_share,
)


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


def resolve_session_for_actor(
    *,
    actor_id: str,
    session_id: str,
    workspace_id: str | None = None,
) -> dict[str, Any] | None:
    owned = get_session_for_user(session_id=session_id, user_id=actor_id)
    if owned is not None:
        return owned

    if workspace_id:
        return resolve_team_session(
            actor_id=actor_id,
            session_id=session_id,
            workspace_id=workspace_id,
        )

    for grant in list_session_grants_for_actor(session_id=session_id, user_id=actor_id):
        session = resolve_team_session(
            actor_id=actor_id,
            session_id=session_id,
            workspace_id=grant["workspace_id"],
        )
        if session is not None:
            return session

    return None


def actor_may_write_session(
    *,
    actor_id: str,
    session_id: str,
    session: dict[str, Any],
    workspace_id: str | None = None,
) -> bool:
    if session.get("user_id") == actor_id:
        return True

    workspace_ids: list[str] = []
    if workspace_id:
        workspace_ids.append(workspace_id)
    else:
        workspace_ids.extend(
            grant["workspace_id"] for grant in list_session_grants_for_actor(session_id=session_id, user_id=actor_id)
        )

    for candidate_workspace_id in workspace_ids:
        if has_workspace_session_grant(
            workspace_id=candidate_workspace_id,
            session_id=session_id,
            user_id=actor_id,
        ):
            grants = list_session_grants_for_actor(session_id=session_id, user_id=actor_id)
            if any(
                grant["workspace_id"] == candidate_workspace_id and grant["access_level"] == "delegate"
                for grant in grants
            ):
                return True

    share_access = get_active_session_share_access_level(session_id)
    if share_access == "delegate":
        for candidate_workspace_id in workspace_ids:
            workspace = get_workspace(candidate_workspace_id)
            if workspace is None:
                continue
            if not any(member["user_id"] == actor_id for member in workspace.get("members", [])):
                continue
            owner_ids = {workspace["owner_id"], *(member["user_id"] for member in workspace.get("members", []))}
            if session.get("user_id") in owner_ids:
                return True

    return False
