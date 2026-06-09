from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ContextMcpError(RuntimeError):
    pass


class ContextMcpService:
    def __init__(self) -> None:
        self._packs: dict[str, dict[str, Any]] = {}
        self._session_pack_ids: dict[str, set[str]] = {}
        self._connectors: dict[str, dict[str, Any]] = {}

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

        if session_id:
            self.attach_pack(user_id=user_id, session_id=session_id, pack_id=pack_id)

        return self._packs[pack_id]

    def list_packs(self, *, user_id: str, session_id: str | None = None) -> list[dict[str, Any]]:
        rows = []
        for pack in self._packs.values():
            if pack["owner_id"] != user_id:
                continue
            if session_id and session_id not in pack["attached_sessions"]:
                continue
            rows.append(pack)
        return sorted(rows, key=lambda item: item["updated_at"], reverse=True)

    def get_pack(self, *, user_id: str, pack_id: str) -> dict[str, Any]:
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
        return pack

    def compose_session_context(self, *, user_id: str, session_id: str, max_snippets: int = 6) -> dict[str, Any]:
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
        connector_id = f"mcp_{uuid4().hex[:10]}"
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
            "created_at": utc_now_iso(),
            "updated_at": utc_now_iso(),
        }
        self._connectors[connector_id] = connector
        return connector

    def list_connectors(self, *, user_id: str) -> list[dict[str, Any]]:
        items = [item for item in self._connectors.values() if item["owner_id"] == user_id]
        return sorted(items, key=lambda row: row["updated_at"], reverse=True)

    def toggle_connector(self, *, user_id: str, connector_id: str, enabled: bool) -> dict[str, Any]:
        connector = self._connectors.get(connector_id)
        if connector is None or connector["owner_id"] != user_id:
            raise ContextMcpError("MCP connector not found")
        connector["enabled"] = enabled
        connector["updated_at"] = utc_now_iso()
        return connector

    def invoke_connector(
        self,
        *,
        user_id: str,
        connector_id: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
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
        return {
            "connector_id": connector_id,
            "tool_name": tool_name,
            "result": result_payload,
            "invoked_at": utc_now_iso(),
        }


context_mcp_service = ContextMcpService()
