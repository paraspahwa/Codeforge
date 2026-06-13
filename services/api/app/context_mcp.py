from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .db import (
    list_context_packs_store,
    list_mcp_connectors_store,
    upsert_context_pack_store,
    upsert_mcp_connector_store,
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ContextMcpError(RuntimeError):
    pass


class ContextMcpService:
    def __init__(self) -> None:
        self._packs: dict[str, dict[str, Any]] = {}
        self._session_pack_ids: dict[str, set[str]] = {}
        self._connectors: dict[str, dict[str, Any]] = {}
        self._loaded_users: set[str] = set()

    def _ensure_user_loaded(self, user_id: str) -> None:
        if user_id in self._loaded_users:
            return
        for row in list_context_packs_store(user_id):
            pack_id = str(row["pack_id"])
            tags = json.loads(row.get("tags_json") or "[]")
            snippets = json.loads(row.get("snippets_json") or "[]")
            attached = [item for item in tags if isinstance(item, str) and item.startswith("sess:")]
            clean_tags = [item for item in tags if not str(item).startswith("sess:")]
            self._packs[pack_id] = {
                "pack_id": pack_id,
                "owner_id": row["owner_id"],
                "session_id": attached[0].replace("sess:", "") if attached else None,
                "title": row["title"],
                "summary": row["summary"],
                "tags": clean_tags,
                "snippets": snippets,
                "attached_sessions": [item.replace("sess:", "") for item in attached],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            for session_id in self._packs[pack_id]["attached_sessions"]:
                self._session_pack_ids.setdefault(session_id, set()).add(pack_id)

        for row in list_mcp_connectors_store(user_id):
            config = json.loads(row.get("config_json") or "{}")
            connector_id = str(row["connector_id"])
            self._connectors[connector_id] = {
                "connector_id": connector_id,
                "owner_id": row["owner_id"],
                "name": row["name"],
                "description": config.get("description", ""),
                "endpoint": row["endpoint"],
                "transport": row["transport"],
                "tools": json.loads(row.get("tools_json") or "[]"),
                "enabled": bool(row.get("enabled", 1)),
                "last_result": config.get("last_result", "never invoked"),
                "created_at": row["created_at"],
                "updated_at": config.get("updated_at", row["created_at"]),
            }
        self._loaded_users.add(user_id)

    def _persist_pack(self, pack: dict[str, Any]) -> None:
        tags = list(pack.get("tags", []))
        for session_id in pack.get("attached_sessions", []):
            marker = f"sess:{session_id}"
            if marker not in tags:
                tags.append(marker)
        upsert_context_pack_store(
            pack_id=pack["pack_id"],
            owner_id=pack["owner_id"],
            title=pack["title"],
            summary=pack["summary"],
            tags_json=json.dumps(tags),
            snippets_json=json.dumps(pack.get("snippets", [])),
            created_at=pack["created_at"],
            updated_at=pack["updated_at"],
        )

    def _persist_connector(self, connector: dict[str, Any]) -> None:
        upsert_mcp_connector_store(
            connector_id=connector["connector_id"],
            owner_id=connector["owner_id"],
            name=connector["name"],
            transport=connector["transport"],
            endpoint=connector["endpoint"],
            tools_json=json.dumps(connector.get("tools", [])),
            enabled=bool(connector.get("enabled", True)),
            config_json=json.dumps(
                {
                    "description": connector.get("description", ""),
                    "last_result": connector.get("last_result", ""),
                    "updated_at": connector.get("updated_at", utc_now_iso()),
                }
            ),
            created_at=connector["created_at"],
        )

    def create_pack(
        self,
        *,
        user_id: str,
        session_id: str | None,
        title: str,
        summary: str,
        tags: list[str],
        snippets: list[str],
    ) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        if not snippets:
            raise ContextMcpError("Context packs require at least one snippet")

        pack_id = f"ctx_{uuid4().hex[:10]}"
        now = utc_now_iso()
        cleaned_snippets = [item.strip() for item in snippets if item and item.strip()]
        if not cleaned_snippets:
            raise ContextMcpError("Context pack snippets are empty")

        pack = {
            "pack_id": pack_id,
            "owner_id": user_id,
            "session_id": session_id,
            "title": title.strip() or "Context pack",
            "summary": summary.strip() or "Reusable context",
            "tags": [tag.strip() for tag in tags if tag.strip()],
            "snippets": cleaned_snippets[:40],
            "attached_sessions": [session_id] if session_id else [],
            "created_at": now,
            "updated_at": now,
        }
        self._packs[pack_id] = pack
        self._persist_pack(pack)

        if session_id:
            self.attach_pack(user_id=user_id, session_id=session_id, pack_id=pack_id)

        return self._packs[pack_id]

    def list_packs(self, *, user_id: str, session_id: str | None = None) -> list[dict[str, Any]]:
        self._ensure_user_loaded(user_id)
        rows = []
        for pack in self._packs.values():
            if pack["owner_id"] != user_id:
                continue
            if session_id and session_id not in pack["attached_sessions"]:
                continue
            rows.append(pack)
        return sorted(rows, key=lambda item: item["updated_at"], reverse=True)

    def get_pack(self, *, user_id: str, pack_id: str) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        pack = self._packs.get(pack_id)
        if pack is None or pack["owner_id"] != user_id:
            raise ContextMcpError("Context pack not found")
        return pack

    def attach_pack(self, *, user_id: str, session_id: str, pack_id: str) -> dict[str, Any]:
        pack = self.get_pack(user_id=user_id, pack_id=pack_id)

        session_pack_ids = self._session_pack_ids.setdefault(session_id, set())
        session_pack_ids.add(pack_id)

        attached = set(pack.get("attached_sessions", []))
        attached.add(session_id)
        pack["attached_sessions"] = sorted(attached)
        pack["updated_at"] = utc_now_iso()
        self._persist_pack(pack)
        return pack

    def compose_session_context(self, *, user_id: str, session_id: str, max_snippets: int = 6) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        snippet_rows: list[dict[str, str]] = []
        session_pack_ids = self._session_pack_ids.get(session_id, set())

        for pack_id in session_pack_ids:
            pack = self._packs.get(pack_id)
            if not pack or pack["owner_id"] != user_id:
                continue
            for snippet in pack["snippets"]:
                snippet_rows.append({
                    "pack_id": pack["pack_id"],
                    "title": pack["title"],
                    "snippet": snippet,
                })
                if len(snippet_rows) >= max_snippets:
                    break
            if len(snippet_rows) >= max_snippets:
                break

        summary = f"Loaded {len(snippet_rows)} context snippet(s)"
        composed_text = "\n".join(
            f"[{row['title']}] {row['snippet']}" for row in snippet_rows
        )

        return {
            "session_id": session_id,
            "summary": summary,
            "snippets": snippet_rows,
            "composed_text": composed_text,
        }

    def register_connector(
        self,
        *,
        user_id: str,
        name: str,
        description: str,
        endpoint: str,
        transport: str,
        tools: list[str],
    ) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        connector_id = f"mcp_{uuid4().hex[:10]}"
        now = utc_now_iso()
        connector = {
            "connector_id": connector_id,
            "owner_id": user_id,
            "name": name.strip(),
            "description": description.strip(),
            "endpoint": endpoint.strip(),
            "transport": transport,
            "tools": [tool.strip() for tool in tools if tool.strip()],
            "enabled": True,
            "last_result": "never invoked",
            "created_at": now,
            "updated_at": now,
        }
        self._connectors[connector_id] = connector
        self._persist_connector(connector)
        return connector

    def list_connectors(self, *, user_id: str) -> list[dict[str, Any]]:
        self._ensure_user_loaded(user_id)
        items = [item for item in self._connectors.values() if item["owner_id"] == user_id]
        return sorted(items, key=lambda row: row["updated_at"], reverse=True)

    def toggle_connector(self, *, user_id: str, connector_id: str, enabled: bool) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        connector = self._connectors.get(connector_id)
        if connector is None or connector["owner_id"] != user_id:
            raise ContextMcpError("MCP connector not found")
        connector["enabled"] = enabled
        connector["updated_at"] = utc_now_iso()
        self._persist_connector(connector)
        return connector

    def invoke_connector(
        self,
        *,
        user_id: str,
        connector_id: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        connector = self._connectors.get(connector_id)
        if connector is None or connector["owner_id"] != user_id:
            raise ContextMcpError("MCP connector not found")
        if not connector["enabled"]:
            raise ContextMcpError("MCP connector is disabled")

        allowed_tools = set(connector.get("tools", []))
        if tool_name not in allowed_tools:
            raise ContextMcpError("Tool is not registered on this MCP connector")

        from .mcp_transport import invoke_remote_tool

        result_payload = invoke_remote_tool(
            endpoint=str(connector["endpoint"]),
            transport=str(connector.get("transport") or "http"),
            tool_name=tool_name,
            arguments=arguments,
        )

        connector["last_result"] = f"{tool_name} invoked"
        connector["updated_at"] = utc_now_iso()
        self._persist_connector(connector)
        return {
            "connector_id": connector_id,
            "tool_name": tool_name,
            "result": result_payload,
            "invoked_at": utc_now_iso(),
        }


context_mcp_service = ContextMcpService()
