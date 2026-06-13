from __future__ import annotations

from typing import Any

from .db import first_user_message_summaries, get_session_by_id, get_session_for_user, list_sessions_for_user
from .projects_team_store import (
    get_active_session_share_access_level,
    get_workspace,
    has_workspace_session_grant,
    list_grants_received_by_user,
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


def _session_list_entry(
    *,
    session: dict[str, Any],
    access_source: str,
    access_level: str,
    workspace_id: str | None,
    owner_user_id: str,
) -> dict[str, Any]:
    return {
        "session_id": session["session_id"],
        "project_path": session["project_path"],
        "model_preference": session["model_preference"],
        "created_at": session["created_at"],
        "access_source": access_source,
        "access_level": access_level,
        "workspace_id": workspace_id,
        "owner_user_id": owner_user_id,
    }


def list_accessible_sessions_for_actor(
    actor_id: str,
    *,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))

    by_id: dict[str, dict[str, Any]] = {}

    for row in list_sessions_for_user(actor_id, limit=500, offset=0):
        session = get_session_by_id(row["session_id"])
        if session is None:
            continue
        by_id[row["session_id"]] = _session_list_entry(
            session=session,
            access_source="owned",
            access_level="delegate",
            workspace_id=None,
            owner_user_id=actor_id,
        )

    for grant in list_grants_received_by_user(actor_id):
        if resolve_team_session(
            actor_id=actor_id,
            session_id=grant["session_id"],
            workspace_id=grant["workspace_id"],
        ) is None:
            continue

        session = get_session_by_id(grant["session_id"])
        if session is None:
            continue

        existing = by_id.get(grant["session_id"])
        if existing is None:
            by_id[grant["session_id"]] = _session_list_entry(
                session=session,
                access_source="granted",
                access_level=grant["access_level"],
                workspace_id=grant["workspace_id"],
                owner_user_id=session["user_id"],
            )
            continue

        if existing["access_source"] == "granted" and grant["access_level"] == "delegate":
            existing["access_level"] = "delegate"
            if not existing.get("workspace_id"):
                existing["workspace_id"] = grant["workspace_id"]

    ordered = sorted(by_id.values(), key=lambda item: item["created_at"], reverse=True)
    page = ordered[offset : offset + limit]
    summaries = first_user_message_summaries([item["session_id"] for item in page])
    for item in page:
        summary = summaries.get(item["session_id"], "").strip()
        item["summary"] = summary or None
    return page
