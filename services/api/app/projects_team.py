from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
from typing import Any
from uuid import uuid4

from . import audit_store
from . import projects_team_store as store
from .db import list_sessions_for_user


_TEXT_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".css", ".html", ".rs", ".go", ".java", ".sh"}
_MAX_INDEXED_FILES = 80
_MAX_FILE_SIZE_BYTES = 256_000
_MAX_UPLOAD_FILES = 10
_KNOWLEDGE_UPLOAD_DIR = ".codeforge/knowledge/uploads"


class ProjectsTeamError(RuntimeError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_excerpt(text: str, limit: int = 320) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 3]}..."


def _sanitize_upload_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\-]+", "_", base).strip("._")
    return cleaned[:120] or "upload.txt"


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
        store.save_knowledge(state)
        audit_store.record_audit_event(
            actor_id=user_id,
            event_type="projects.knowledge_rebuilt",
            resource_type="knowledge",
            resource_id=state["knowledge_id"],
            session_id=session_id,
            metadata={"title": state["title"], "indexed_files": len(indexed_items)},
        )
        return state

    def upload_knowledge_files(
        self,
        *,
        user_id: str,
        session_id: str,
        project_path: str,
        uploads: list[tuple[str, bytes]],
    ) -> dict[str, Any]:
        if not uploads:
            raise ProjectsTeamError("At least one file is required")
        if len(uploads) > _MAX_UPLOAD_FILES:
            raise ProjectsTeamError(f"Upload at most {_MAX_UPLOAD_FILES} files per request")

        root = Path(project_path).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise ProjectsTeamError("Project path does not exist")

        upload_dir = root / _KNOWLEDGE_UPLOAD_DIR
        upload_dir.mkdir(parents=True, exist_ok=True)

        state = store.get_knowledge_by_session(session_id)
        if state is None or state["user_id"] != user_id:
            knowledge_id = f"kb_{uuid4().hex[:10]}"
            state = {
                "knowledge_id": knowledge_id,
                "session_id": session_id,
                "user_id": user_id,
                "title": "Uploaded project knowledge",
                "project_path": root.as_posix(),
                "summary": "No files indexed yet",
                "items": [],
                "updated_at": utc_now().isoformat(),
            }

        items_by_path = {item["path"]: item for item in state.get("items", [])}
        saved_paths: list[str] = []

        for filename, raw in uploads:
            if len(raw) > _MAX_FILE_SIZE_BYTES:
                raise ProjectsTeamError(f"File {filename} exceeds {_MAX_FILE_SIZE_BYTES} byte limit")

            safe_name = _sanitize_upload_filename(filename)
            suffix = Path(safe_name).suffix.lower()
            if suffix and suffix not in _TEXT_EXTENSIONS:
                raise ProjectsTeamError(f"Unsupported file type for {safe_name}")

            relative = f"{_KNOWLEDGE_UPLOAD_DIR}/{safe_name}"
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(raw)

            text = raw.decode("utf-8", errors="replace")
            items_by_path[relative] = {
                "path": relative,
                "excerpt": _safe_excerpt(text),
                "indexed_at": utc_now().isoformat(),
            }
            saved_paths.append(relative)

        state["items"] = list(items_by_path.values())[:_MAX_INDEXED_FILES]
        state["summary"] = f"Indexed {len(state['items'])} project files ({len(saved_paths)} uploaded)"
        state["updated_at"] = utc_now().isoformat()
        store.save_knowledge(state)

        audit_store.record_audit_event(
            actor_id=user_id,
            event_type="projects.knowledge_uploaded",
            resource_type="knowledge",
            resource_id=state["knowledge_id"],
            session_id=session_id,
            metadata={"paths": saved_paths, "upload_count": len(saved_paths)},
        )
        state["uploaded_paths"] = saved_paths
        return state

    def append_knowledge_snippet(
        self,
        *,
        user_id: str,
        session_id: str,
        project_path: str,
        path_label: str,
        excerpt: str,
    ) -> dict[str, Any]:
        cleaned = _safe_excerpt(excerpt, limit=1200)
        if not cleaned:
            raise ProjectsTeamError("Knowledge snippet cannot be empty")

        root = Path(project_path).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise ProjectsTeamError("Project path does not exist")

        state = store.get_knowledge_by_session(session_id)
        if state is None or state["user_id"] != user_id:
            knowledge_id = f"kb_{uuid4().hex[:10]}"
            state = {
                "knowledge_id": knowledge_id,
                "session_id": session_id,
                "user_id": user_id,
                "title": "Project knowledge",
                "project_path": root.as_posix(),
                "summary": "No files indexed yet",
                "items": [],
                "updated_at": utc_now().isoformat(),
            }

        safe_label = _sanitize_upload_filename(path_label).replace(".", "_")
        relative = f"{_KNOWLEDGE_UPLOAD_DIR}/scrape_{safe_label}.json"
        items_by_path = {item["path"]: item for item in state.get("items", [])}
        items_by_path[relative] = {
            "path": relative,
            "excerpt": cleaned,
            "indexed_at": utc_now().isoformat(),
        }
        state["items"] = list(items_by_path.values())[:_MAX_INDEXED_FILES]
        state["summary"] = f"Indexed {len(state['items'])} knowledge items (latest scrape: {relative})"
        state["updated_at"] = utc_now().isoformat()
        store.save_knowledge(state)

        audit_store.record_audit_event(
            actor_id=user_id,
            event_type="projects.knowledge_scrape_ingested",
            resource_type="knowledge",
            resource_id=state["knowledge_id"],
            session_id=session_id,
            metadata={"path": relative, "source_label": path_label},
        )
        return state

    def list_audit_log(
        self,
        *,
        user_id: str,
        workspace_id: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        workspaces = self.list_workspaces(user_id=user_id)
        workspace_ids = {workspace["workspace_id"] for workspace in workspaces}
        session_ids = {row["session_id"] for row in list_sessions_for_user(user_id)}
        return audit_store.list_audit_events_for_user(
            user_id=user_id,
            workspace_ids=workspace_ids,
            session_ids=session_ids,
            workspace_id=workspace_id,
            limit=limit,
        )

    def get_knowledge(self, *, user_id: str, session_id: str) -> dict[str, Any]:
        state = store.get_knowledge_by_session(session_id)
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

    def compose_knowledge_context(self, *, user_id: str, session_id: str, query: str, limit: int = 4) -> str:
        state = store.get_knowledge_by_session(session_id)
        if state is None or state["user_id"] != user_id or not state.get("items"):
            return ""

        result = self.query_knowledge(user_id=user_id, session_id=session_id, query=query, limit=limit)
        snippets = result.get("results") or []
        if not snippets:
            return ""

        lines = [f"Project knowledge ({state['title']}):"]
        for item in snippets:
            lines.append(f"- {item['path']}: {item['excerpt']}")
        return "\n".join(lines)

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
        store.save_workspace(workspace)
        audit_store.record_audit_event(
            actor_id=owner_id,
            event_type="team.workspace_created",
            resource_type="workspace",
            resource_id=workspace_id,
            workspace_id=workspace_id,
            metadata={"name": name},
        )
        return workspace

    def list_workspaces(self, *, user_id: str) -> list[dict[str, Any]]:
        return store.list_workspaces_for_user(user_id)

    def add_workspace_member(self, *, actor_id: str, workspace_id: str, member_user_id: str, role: str) -> dict[str, Any]:
        workspace = store.get_workspace(workspace_id)
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")

        actor_role = None
        for member in workspace["members"]:
            if member["user_id"] == actor_id:
                actor_role = member["role"]
                break

        if actor_role not in {"owner", "admin"}:
            raise ProjectsTeamError("Only owner/admin can add workspace members")

        member = {
            "user_id": member_user_id,
            "role": role,
            "added_at": utc_now().isoformat(),
        }
        store.save_workspace_member(workspace_id, member)
        updated = store.get_workspace(workspace_id) or workspace
        audit_store.record_audit_event(
            actor_id=actor_id,
            event_type="team.workspace_member_added",
            resource_type="workspace_member",
            resource_id=member_user_id,
            workspace_id=workspace_id,
            metadata={"role": role},
        )
        return updated

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
        store.save_session_share(share)
        audit_store.record_audit_event(
            actor_id=user_id,
            event_type="team.session_share_created",
            resource_type="session_share",
            resource_id=share_id,
            session_id=session_id,
            metadata={"access_level": access_level, "expires_in_hours": expires_in_hours},
        )
        return share

    def grant_workspace_session(
        self,
        *,
        actor_id: str,
        workspace_id: str,
        session_id: str,
        granted_to_user_id: str,
        access_level: str = "delegate",
    ) -> dict[str, Any]:
        from .db import get_session_for_user

        workspace = store.get_workspace(workspace_id)
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")

        actor_role = next((member["role"] for member in workspace["members"] if member["user_id"] == actor_id), None)
        if actor_role not in {"owner", "admin"} and actor_id != workspace["owner_id"]:
            raise ProjectsTeamError("Only workspace owner/admin can grant session access")

        if not any(member["user_id"] == granted_to_user_id for member in workspace["members"]):
            raise ProjectsTeamError("Granted user must be a workspace member")

        session = get_session_for_user(session_id=session_id, user_id=actor_id)
        if session is None and actor_id == workspace["owner_id"]:
            session = get_session_for_user(session_id=session_id, user_id=workspace["owner_id"])
        if session is None:
            raise ProjectsTeamError("Actor must own the session to grant workspace access")

        grant = {
            "grant_id": f"grant_{uuid4().hex[:10]}",
            "workspace_id": workspace_id,
            "session_id": session_id,
            "granted_to_user_id": granted_to_user_id,
            "granted_by": actor_id,
            "access_level": access_level,
            "created_at": utc_now().isoformat(),
        }
        store.save_workspace_session_grant(grant)
        audit_store.record_audit_event(
            actor_id=actor_id,
            event_type="team.session_grant_created",
            resource_type="workspace_session_grant",
            resource_id=grant["grant_id"],
            workspace_id=workspace_id,
            session_id=session_id,
            metadata={"granted_to_user_id": granted_to_user_id, "access_level": access_level},
        )
        return grant

    def list_workspace_session_grants(self, *, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        workspace = store.get_workspace(workspace_id)
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")
        if not any(member["user_id"] == user_id for member in workspace["members"]):
            raise ProjectsTeamError("Only workspace members can list session grants")
        return store.list_workspace_session_grants(workspace_id)

    def resolve_session_share(self, *, share_id: str) -> dict[str, Any]:
        share = store.get_session_share(share_id)
        if share is None:
            raise ProjectsTeamError("Share not found")

        if datetime.fromisoformat(share["expires_at"]) < utc_now():
            raise ProjectsTeamError("Share link has expired")
        return share

    def record_session_share_resolved(self, *, actor_id: str, share: dict[str, Any]) -> None:
        audit_store.record_audit_event(
            actor_id=actor_id,
            event_type="team.session_share_resolved",
            resource_type="session_share",
            resource_id=share["share_id"],
            session_id=share["session_id"],
            metadata={"access_level": share["access_level"]},
        )

    def compose_style_context(
        self,
        *,
        user_id: str,
        workspace_id: str | None = None,
        limit: int = 3,
    ) -> str:
        guides: list[dict[str, Any]] = []
        if workspace_id:
            guides = store.list_style_guides_for_workspace(workspace_id)
        else:
            for workspace in self.list_workspaces(user_id=user_id):
                guides.extend(store.list_style_guides_for_workspace(workspace["workspace_id"]))
        if not guides:
            return ""
        selected = guides[:limit]
        lines = ["Team style guides:"]
        for guide in selected:
            lines.append(f"- [{guide['guide_type']}] {guide['title']}: {guide['content'][:400]}")
        return "\n".join(lines)

    def create_style_guide(
        self,
        *,
        actor_id: str,
        workspace_id: str,
        title: str,
        guide_type: str,
        content: str,
    ) -> dict[str, Any]:
        workspace = store.get_workspace(workspace_id)
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")
        if not any(member["user_id"] == actor_id for member in workspace["members"]):
            raise ProjectsTeamError("Only workspace members can create style guides")

        now = utc_now().isoformat()
        guide = {
            "guide_id": f"style_{uuid4().hex[:10]}",
            "workspace_id": workspace_id,
            "title": title.strip(),
            "guide_type": guide_type,
            "content": content.strip(),
            "updated_by": actor_id,
            "created_at": now,
            "updated_at": now,
        }
        store.save_style_guide(guide)
        audit_store.record_audit_event(
            actor_id=actor_id,
            event_type="team.style_guide_created",
            resource_type="style_guide",
            resource_id=guide["guide_id"],
            workspace_id=workspace_id,
            metadata={"title": guide["title"], "guide_type": guide_type},
        )
        return guide

    def update_style_guide(
        self,
        *,
        actor_id: str,
        guide_id: str,
        title: str | None = None,
        guide_type: str | None = None,
        content: str | None = None,
    ) -> dict[str, Any]:
        guide = store.get_style_guide(guide_id)
        if guide is None:
            raise ProjectsTeamError("Style guide not found")
        workspace = store.get_workspace(guide["workspace_id"])
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")
        if not any(member["user_id"] == actor_id for member in workspace["members"]):
            raise ProjectsTeamError("Only workspace members can update style guides")

        next_title = title.strip() if title else guide["title"]
        next_type = guide_type or guide["guide_type"]
        next_content = content.strip() if content else guide["content"]
        updated_at = utc_now().isoformat()
        store.update_style_guide(
            guide_id,
            title=next_title,
            guide_type=next_type,
            content=next_content,
            updated_by=actor_id,
            updated_at=updated_at,
        )
        audit_store.record_audit_event(
            actor_id=actor_id,
            event_type="team.style_guide_updated",
            resource_type="style_guide",
            resource_id=guide_id,
            workspace_id=guide["workspace_id"],
            metadata={"title": next_title},
        )
        return store.get_style_guide(guide_id) or guide

    def list_style_guides(self, *, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        workspace = store.get_workspace(workspace_id)
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")
        if not any(member["user_id"] == user_id for member in workspace["members"]):
            raise ProjectsTeamError("Only workspace members can list style guides")
        return store.list_style_guides_for_workspace(workspace_id)

    def create_delegation(
        self,
        *,
        requester_id: str,
        workspace_id: str,
        session_id: str,
        assigned_role: str,
        task: str,
        priority: str,
        orchestration_mode: str = "sequential",
        agent_roles: list[str] | None = None,
        require_step_approval: bool = False,
    ) -> dict[str, Any]:
        workspace = store.get_workspace(workspace_id)
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
            "orchestration_mode": orchestration_mode,
            "agent_roles": agent_roles or [],
            "require_step_approval": require_step_approval,
            "current_step_index": 0,
            "steps": [],
            "status": "queued",
            "note": "Queued for agent-team execution",
            "created_at": utc_now().isoformat(),
            "completed_at": None,
        }
        store.save_delegation(delegation)
        audit_store.record_audit_event(
            actor_id=requester_id,
            event_type="team.delegation_created",
            resource_type="delegation",
            resource_id=task_id,
            workspace_id=workspace_id,
            session_id=session_id,
            metadata={"assigned_role": assigned_role, "priority": priority},
        )
        return delegation

    def list_delegations(self, *, user_id: str, workspace_id: str | None = None) -> list[dict[str, Any]]:
        visible_workspace_ids = {
            workspace["workspace_id"]
            for workspace in self.list_workspaces(user_id=user_id)
        }
        return store.list_delegations_for_workspaces(visible_workspace_ids, workspace_id)

    async def _run_delegation_orchestration(
        self,
        *,
        actor_id: str,
        delegation: dict[str, Any],
        project_path: str,
        start_at: int = 1,
        prior_steps: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        from .delegation_orchestrator import execute_delegation_chain

        task_id = delegation["task_id"]
        orchestration_mode = str(delegation.get("orchestration_mode") or "single")
        agent_roles = list(delegation.get("agent_roles") or [])
        require_step_approval = bool(delegation.get("require_step_approval"))

        style_context = self.compose_style_context(
            user_id=actor_id,
            workspace_id=delegation["workspace_id"],
        )
        knowledge_context = self.compose_knowledge_context(
            user_id=actor_id,
            session_id=delegation["session_id"],
            query=delegation["task"],
        )

        if orchestration_mode == "single" and not agent_roles:
            from .agent import build_agent_run

            role_prefix = f"[Delegated to {delegation['assigned_role']}] "
            prompt = f"{role_prefix}{delegation['task']}"
            if style_context:
                prompt = f"{prompt}\n\n{style_context}"
            if knowledge_context:
                prompt = f"{prompt}\n\n{knowledge_context}"
            run = await build_agent_run(
                prompt=prompt,
                session_id=delegation["session_id"],
                project_path=project_path,
                current_file=None,
            )
            steps = [
                {
                    "step_index": 1,
                    "role": delegation["assigned_role"],
                    "status": "completed",
                    "output": run.assistant_message[:2000],
                    "started_at": utc_now().isoformat(),
                    "completed_at": utc_now().isoformat(),
                }
            ]
            note = f"Completed by {delegation['assigned_role']}: {run.assistant_message[:240]}"
            paused = False
        else:
            steps, note, paused = await execute_delegation_chain(
                actor_id=actor_id,
                delegation=delegation,
                project_path=project_path,
                orchestration_mode=orchestration_mode,
                agent_roles=agent_roles,
                style_context=style_context,
                knowledge_context=knowledge_context,
                start_at=start_at,
                prior_steps=prior_steps,
                require_step_approval=require_step_approval,
            )

        current_step_index = steps[-1]["step_index"] if steps else 0
        if paused:
            store.update_delegation(
                task_id,
                status="awaiting_approval",
                note=note,
                steps=steps,
                current_step_index=current_step_index,
            )
            audit_store.record_audit_event(
                actor_id=actor_id,
                event_type="team.delegation_awaiting_approval",
                resource_type="delegation",
                resource_id=task_id,
                workspace_id=delegation["workspace_id"],
                session_id=delegation["session_id"],
                metadata={"step_index": current_step_index},
            )
            return store.get_delegation(task_id) or delegation

        store.update_delegation(
            task_id,
            status="completed",
            note=note,
            completed_at=utc_now().isoformat(),
            steps=steps,
            current_step_index=current_step_index,
        )
        audit_store.record_audit_event(
            actor_id=actor_id,
            event_type="team.delegation_executed",
            resource_type="delegation",
            resource_id=task_id,
            workspace_id=delegation["workspace_id"],
            session_id=delegation["session_id"],
            metadata={"status": "completed"},
        )
        return store.get_delegation(task_id) or delegation

    async def execute_delegation(self, *, actor_id: str, task_id: str, project_path: str) -> dict[str, Any]:
        delegation = store.get_delegation(task_id)
        if delegation is None:
            raise ProjectsTeamError("Delegation not found")

        workspace = store.get_workspace(delegation["workspace_id"])
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")

        if not any(member["user_id"] == actor_id for member in workspace["members"]):
            raise ProjectsTeamError("Only workspace members can execute delegations")

        if delegation["status"] == "awaiting_approval":
            raise ProjectsTeamError("Delegation is awaiting step approval; use the approve-step endpoint")

        if delegation["status"] not in {"queued", "failed"}:
            raise ProjectsTeamError(f"Delegation is already {delegation['status']}")

        orchestration_mode = str(delegation.get("orchestration_mode") or "single")
        store.update_delegation(
            task_id,
            status="in_progress",
            note=f"Orchestration {orchestration_mode} started for {delegation['assigned_role']}",
        )

        try:
            return await self._run_delegation_orchestration(
                actor_id=actor_id,
                delegation=delegation,
                project_path=project_path,
                start_at=1,
                prior_steps=[],
            )
        except Exception as exc:
            store.update_delegation(
                task_id,
                status="failed",
                note=f"Delegation failed: {exc}",
                completed_at=utc_now().isoformat(),
            )
            audit_store.record_audit_event(
                actor_id=actor_id,
                event_type="team.delegation_executed",
                resource_type="delegation",
                resource_id=task_id,
                workspace_id=delegation["workspace_id"],
                session_id=delegation["session_id"],
                metadata={"status": "failed", "error": str(exc)},
            )
            raise ProjectsTeamError(str(exc)) from exc

    async def decide_delegation_step(
        self,
        *,
        actor_id: str,
        task_id: str,
        project_path: str,
        approved: bool,
        note: str = "",
    ) -> dict[str, Any]:
        delegation = store.get_delegation(task_id)
        if delegation is None:
            raise ProjectsTeamError("Delegation not found")

        workspace = store.get_workspace(delegation["workspace_id"])
        if workspace is None:
            raise ProjectsTeamError("Workspace not found")

        actor_role = next(
            (member["role"] for member in workspace["members"] if member["user_id"] == actor_id),
            None,
        )
        if actor_role not in {"owner", "admin"} and actor_id != workspace.get("owner_id"):
            raise ProjectsTeamError("Only workspace owners or admins can approve delegation steps")

        if delegation["status"] != "awaiting_approval":
            raise ProjectsTeamError("Delegation is not awaiting step approval")

        if not approved:
            rejection_note = note.strip() or "Delegation step rejected by reviewer"
            store.update_delegation(
                task_id,
                status="failed",
                note=rejection_note,
                completed_at=utc_now().isoformat(),
            )
            audit_store.record_audit_event(
                actor_id=actor_id,
                event_type="team.delegation_step_rejected",
                resource_type="delegation",
                resource_id=task_id,
                workspace_id=delegation["workspace_id"],
                session_id=delegation["session_id"],
                metadata={"step_index": delegation.get("current_step_index", 0)},
            )
            return store.get_delegation(task_id) or delegation

        next_start = int(delegation.get("current_step_index") or 0) + 1
        prior_steps = list(delegation.get("steps") or [])
        store.update_delegation(
            task_id,
            status="in_progress",
            note=note.strip() or f"Continuing orchestration from step {next_start}",
        )
        try:
            return await self._run_delegation_orchestration(
                actor_id=actor_id,
                delegation=delegation,
                project_path=project_path,
                start_at=next_start,
                prior_steps=prior_steps,
            )
        except Exception as exc:
            store.update_delegation(
                task_id,
                status="failed",
                note=f"Delegation failed after approval: {exc}",
                completed_at=utc_now().isoformat(),
            )
            raise ProjectsTeamError(str(exc)) from exc


projects_team_service = ProjectsTeamService()
