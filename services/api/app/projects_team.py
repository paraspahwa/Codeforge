from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
from typing import Any
from uuid import uuid4


_TEXT_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".css", ".html", ".rs", ".go", ".java", ".sh"}
_MAX_INDEXED_FILES = 80
_MAX_FILE_SIZE_BYTES = 256_000


class ProjectsTeamError(RuntimeError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_excerpt(text: str, limit: int = 320) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 3]}..."


def _score_item(query: str, path: str, content: str) -> int:
    query_lower = query.lower()
    path_lower = path.lower()
    content_lower = content.lower()

    score = 0
    if query_lower in path_lower:
        score += 8
    score += content_lower.count(query_lower)

    query_terms = [term for term in re.split(r"\W+", query_lower) if term]
    for term in query_terms:
        if term in path_lower:
            score += 3
        score += min(5, content_lower.count(term))

    return score


@dataclass
class KnowledgeItem:
    path: str
    excerpt: str
    indexed_at: str


class ProjectsTeamService:
    def __init__(self) -> None:
        self._knowledge_by_session: dict[str, dict[str, Any]] = {}
        self._workspaces: dict[str, dict[str, Any]] = {}
        self._session_shares: dict[str, dict[str, Any]] = {}
        self._delegations: list[dict[str, Any]] = []

    def rebuild_knowledge(self, *, user_id: str, session_id: str, project_path: str, title: str) -> dict[str, Any]:
        root = Path(project_path).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise ProjectsTeamError("Project path does not exist")

        indexed_items: list[KnowledgeItem] = []
        for path in root.rglob("*"):
            if len(indexed_items) >= _MAX_INDEXED_FILES:
                break
            if not path.is_file() or path.suffix.lower() not in _TEXT_EXTENSIONS:
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if size > _MAX_FILE_SIZE_BYTES:
                continue

            try:
                content = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue

            relative = path.relative_to(root).as_posix()
            indexed_items.append(
                KnowledgeItem(
                    path=relative,
                    excerpt=_safe_excerpt(content),
                    indexed_at=utc_now().isoformat(),
                )
            )

        summary = f"Indexed {len(indexed_items)} project files for context retrieval"
        knowledge_id = f"kb_{uuid4().hex[:10]}"
        state = {
            "knowledge_id": knowledge_id,
            "session_id": session_id,
            "user_id": user_id,
            "title": title or "Project knowledge base",
            "project_path": root.as_posix(),
            "summary": summary,
            "items": [item.__dict__ for item in indexed_items],
            "updated_at": utc_now().isoformat(),
        }
        self._knowledge_by_session[session_id] = state
        return state

    def get_knowledge(self, *, user_id: str, session_id: str) -> dict[str, Any]:
        state = self._knowledge_by_session.get(session_id)
        if state is None or state["user_id"] != user_id:
            raise ProjectsTeamError("Knowledge base not found")
        return state

    def query_knowledge(self, *, user_id: str, session_id: str, query: str, limit: int = 6) -> dict[str, Any]:
        state = self.get_knowledge(user_id=user_id, session_id=session_id)
        items = []
        for item in state["items"]:
            score = _score_item(query, item["path"], item["excerpt"])
            if score <= 0:
                continue
            items.append(
                {
                    "path": item["path"],
                    "excerpt": item["excerpt"],
                    "score": score,
                }
            )

        items.sort(key=lambda entry: entry["score"], reverse=True)
        top = items[: max(1, min(limit, 20))]
        return {
            "knowledge_id": state["knowledge_id"],
            "query": query,
            "results": top,
            "summary": f"Returned {len(top)} result(s) from {len(state['items'])} indexed files",
        }

    def create_workspace(self, *, owner_id: str, name: str, description: str) -> dict[str, Any]:
        workspace_id = f"ws_{uuid4().hex[:10]}"
        now = utc_now().isoformat()
        workspace = {
            "workspace_id": workspace_id,
            "name": name,
            "description": description,
            "owner_id": owner_id,
            "created_at": now,
            "members": [
                {
                    "user_id": owner_id,
                    "role": "owner",
                    "added_at": now,
                }
            ],
        }
        self._workspaces[workspace_id] = workspace
        return workspace

    def list_workspaces(self, *, user_id: str) -> list[dict[str, Any]]:
        items = []
        for workspace in self._workspaces.values():
            if any(member["user_id"] == user_id for member in workspace["members"]):
                items.append(workspace)
        return sorted(items, key=lambda entry: entry["created_at"], reverse=True)

    def add_workspace_member(self, *, actor_id: str, workspace_id: str, member_user_id: str, role: str) -> dict[str, Any]:
        workspace = self._workspaces.get(workspace_id)
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")

        actor_role = None
        for member in workspace["members"]:
            if member["user_id"] == actor_id:
                actor_role = member["role"]
                break

        if actor_role not in {"owner", "admin"}:
            raise ProjectsTeamError("Only owner/admin can add workspace members")

        for member in workspace["members"]:
            if member["user_id"] == member_user_id:
                member["role"] = role
                return workspace

        workspace["members"].append(
            {
                "user_id": member_user_id,
                "role": role,
                "added_at": utc_now().isoformat(),
            }
        )
        return workspace

    def create_session_share(
        self,
        *,
        user_id: str,
        session_id: str,
        access_level: str,
        expires_in_hours: int,
    ) -> dict[str, Any]:
        now = utc_now()
        share_id = f"share_{uuid4().hex[:12]}"
        share = {
            "share_id": share_id,
            "session_id": session_id,
            "owner_id": user_id,
            "access_level": access_level,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=expires_in_hours)).isoformat(),
        }
        self._session_shares[share_id] = share
        return share

    def resolve_session_share(self, *, share_id: str) -> dict[str, Any]:
        share = self._session_shares.get(share_id)
        if share is None:
            raise ProjectsTeamError("Share not found")

        if datetime.fromisoformat(share["expires_at"]) < utc_now():
            raise ProjectsTeamError("Share link has expired")
        return share

    def create_delegation(
        self,
        *,
        requester_id: str,
        workspace_id: str,
        session_id: str,
        assigned_role: str,
        task: str,
        priority: str,
    ) -> dict[str, Any]:
        workspace = self._workspaces.get(workspace_id)
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")

        if not any(member["user_id"] == requester_id for member in workspace["members"]):
            raise ProjectsTeamError("Requester is not a workspace member")

        task_id = f"deleg_{uuid4().hex[:10]}"
        delegation = {
            "task_id": task_id,
            "workspace_id": workspace_id,
            "session_id": session_id,
            "requester_id": requester_id,
            "assigned_role": assigned_role,
            "task": task,
            "priority": priority,
            "status": "queued",
            "note": "Delegation recorded; execution wiring is pending agent-team runtime",
            "created_at": utc_now().isoformat(),
        }
        self._delegations.append(delegation)
        return delegation

    def list_delegations(self, *, user_id: str, workspace_id: str | None = None) -> list[dict[str, Any]]:
        visible_workspace_ids = {
            workspace["workspace_id"]
            for workspace in self.list_workspaces(user_id=user_id)
        }

        rows = []
        for item in self._delegations:
            if item["workspace_id"] not in visible_workspace_ids:
                continue
            if workspace_id and item["workspace_id"] != workspace_id:
                continue
            rows.append(item)

        return sorted(rows, key=lambda entry: entry["created_at"], reverse=True)


projects_team_service = ProjectsTeamService()
