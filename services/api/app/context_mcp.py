from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .db import (
    delete_mcp_connector_store,
    list_context_packs_store,
    list_mcp_connectors_store,
    upsert_context_pack_store,
    upsert_mcp_connector_store,
)
from .mcp_catalog import get_server, list_categories, list_servers
from .catalog_versions import catalog_version_for


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
                "catalog_id": config.get("catalog_id"),
                "integration": config.get("integration"),
                "category": config.get("category"),
                "package": config.get("package"),
                "env_vars": config.get("env_vars", []),
                "setup_note": config.get("setup_note", ""),
                "catalog_version": config.get("catalog_version"),
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
                    "catalog_id": connector.get("catalog_id"),
                    "integration": connector.get("integration"),
                    "category": connector.get("category"),
                    "package": connector.get("package"),
                    "env_vars": connector.get("env_vars", []),
                    "setup_note": connector.get("setup_note", ""),
                    "catalog_version": connector.get("catalog_version"),
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
        catalog_id: str | None = None,
        integration: str | None = None,
        category: str | None = None,
        package: str | None = None,
        env_vars: list[str] | None = None,
        setup_note: str = "",
        catalog_version: str | None = None,
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
            "catalog_id": catalog_id,
            "integration": integration,
            "category": category,
            "package": package,
            "env_vars": env_vars or [],
            "setup_note": setup_note,
            "catalog_version": catalog_version,
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
        resolved_id = connector_id
        connector = self._connectors.get(resolved_id)
        if connector is None or connector["owner_id"] != user_id:
            catalog_match = self._connector_for_catalog(user_id=user_id, server_id=connector_id)
            if catalog_match is not None:
                resolved_id = str(catalog_match["connector_id"])
                connector = catalog_match
        if connector is None or connector["owner_id"] != user_id:
            raise ContextMcpError("MCP connector not found")
        if not connector["enabled"]:
            raise ContextMcpError("MCP connector is disabled")

        allowed_tools = set(connector.get("tools", []))
        if tool_name not in allowed_tools:
            raise ContextMcpError("Tool is not registered on this MCP connector")

        integration = connector.get("integration") or connector.get("transport")
        if integration == "native" or str(connector.get("endpoint", "")).startswith("native://"):
            from .mcp_native import invoke_native_tool

            catalog_id = connector.get("catalog_id") or str(connector["endpoint"]).replace("native://", "")
            result_payload = invoke_native_tool(
                server_id=catalog_id,
                tool_name=tool_name,
                arguments=arguments,
            )
        else:
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
            "connector_id": resolved_id,
            "tool_name": tool_name,
            "result": result_payload,
            "invoked_at": utc_now_iso(),
        }

    def _installed_catalog_ids(self, *, user_id: str) -> set[str]:
        self._ensure_user_loaded(user_id)
        ids: set[str] = set()
        for connector in self._connectors.values():
            if connector["owner_id"] != user_id:
                continue
            catalog_id = connector.get("catalog_id")
            if catalog_id:
                ids.add(str(catalog_id))
        return ids

    def _connector_for_catalog(self, *, user_id: str, server_id: str) -> dict[str, Any] | None:
        self._ensure_user_loaded(user_id)
        for connector in self._connectors.values():
            if connector["owner_id"] == user_id and connector.get("catalog_id") == server_id:
                return connector
        return None

    def list_catalog(self, *, user_id: str, category: str | None = None) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        servers = []
        enabled_count = 0
        for row in list_servers(category=category):
            connector = self._connector_for_catalog(user_id=user_id, server_id=row["id"])
            catalog_version = catalog_version_for(row)
            installed_version = connector.get("catalog_version") if connector else None
            enabled = bool(connector and connector.get("enabled"))
            if enabled:
                enabled_count += 1
            servers.append({
                **row,
                "installed": connector is not None,
                "enabled": enabled,
                "connector_id": connector["connector_id"] if connector else None,
                "catalog_version": catalog_version,
                "installed_version": installed_version,
                "update_available": bool(connector) and (
                    not installed_version or installed_version != catalog_version
                ),
            })
        return {
            "categories": list_categories(),
            "servers": servers,
            "total": len(servers),
            "installed_count": sum(1 for row in servers if row["installed"]),
            "enabled_count": enabled_count,
            "catalog_revision": catalog_version_for(),
        }

    def install_catalog_server(self, *, user_id: str, server_id: str) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        server = get_server(server_id)
        if server is None:
            raise ContextMcpError(f"Unknown MCP catalog server: {server_id}")

        existing = self._connector_for_catalog(user_id=user_id, server_id=server_id)
        if existing:
            existing["enabled"] = True
            if not existing.get("catalog_version"):
                existing["catalog_version"] = catalog_version_for(server)
            existing["updated_at"] = utc_now_iso()
            self._persist_connector(existing)
            return {"connector": existing, "created": False, "server_id": server_id}

        catalog_version = catalog_version_for(server)
        connector = self.register_connector(
            user_id=user_id,
            name=server["name"],
            description=server.get("description", ""),
            endpoint=server["endpoint"],
            transport=server["transport"],
            tools=server.get("tools", []),
            catalog_id=server["id"],
            integration=server.get("integration"),
            category=server.get("category"),
            package=server.get("package"),
            env_vars=server.get("env_vars", []),
            setup_note=server.get("setup_note", ""),
            catalog_version=catalog_version,
        )
        return {"connector": connector, "created": True, "server_id": server_id}

    def disable_catalog_server(self, *, user_id: str, server_id: str) -> dict[str, Any]:
        connector = self._connector_for_catalog(user_id=user_id, server_id=server_id)
        if connector is None:
            return {"server_id": server_id, "removed": False}
        connector_id = connector["connector_id"]
        delete_mcp_connector_store(connector_id=connector_id, owner_id=user_id)
        self._connectors.pop(connector_id, None)
        return {"server_id": server_id, "removed": True, "connector_id": connector_id}

    def update_catalog_server(self, *, user_id: str, server_id: str) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        server = get_server(server_id)
        if server is None:
            raise ContextMcpError(f"Unknown MCP catalog server: {server_id}")
        connector = self._connector_for_catalog(user_id=user_id, server_id=server_id)
        if connector is None:
            raise ContextMcpError("Enable the MCP server before updating")

        catalog_version = catalog_version_for(server)
        if connector.get("catalog_version") == catalog_version:
            return {
                "server_id": server_id,
                "updated": False,
                "catalog_version": catalog_version,
                "installed_version": connector.get("catalog_version"),
                "connector": connector,
            }

        connector["name"] = server["name"]
        connector["description"] = server.get("description", "")
        connector["endpoint"] = server["endpoint"]
        connector["transport"] = server["transport"]
        connector["tools"] = server.get("tools", [])
        connector["integration"] = server.get("integration")
        connector["category"] = server.get("category")
        connector["package"] = server.get("package")
        connector["env_vars"] = server.get("env_vars", [])
        connector["setup_note"] = server.get("setup_note", "")
        connector["catalog_version"] = catalog_version
        connector["enabled"] = True
        connector["updated_at"] = utc_now_iso()
        self._persist_connector(connector)
        return {
            "server_id": server_id,
            "updated": True,
            "catalog_version": catalog_version,
            "installed_version": catalog_version,
            "connector": connector,
        }

    def install_catalog_category(self, *, user_id: str, category_id: str) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        servers = list_servers(category=category_id)
        if not servers:
            raise ContextMcpError(f"Unknown MCP catalog category: {category_id}")

        created = 0
        connectors = []
        for server in servers:
            result = self.install_catalog_server(user_id=user_id, server_id=server["id"])
            connectors.append(result["connector"])
            if result["created"]:
                created += 1
        return {
            "category_id": category_id,
            "created": created,
            "total": len(connectors),
            "connectors": connectors,
        }

    def install_all_catalog(self, *, user_id: str) -> dict[str, Any]:
        self._ensure_user_loaded(user_id)
        created = 0
        connectors = []
        for server in list_servers():
            result = self.install_catalog_server(user_id=user_id, server_id=server["id"])
            connectors.append(result["connector"])
            if result["created"]:
                created += 1
        return {
            "created": created,
            "total": len(connectors),
            "connectors": connectors,
        }

    def compose_mcp_tools_context(
        self,
        *,
        user_id: str,
        enabled_skills: list[str] | None = None,
    ) -> str:
        self._ensure_user_loaded(user_id)
        enabled = [
            item for item in self._connectors.values()
            if item["owner_id"] == user_id and item.get("enabled")
        ]

        lines: list[str] = []
        agent_reach_connector = self._connector_for_catalog(user_id=user_id, server_id="agent_reach")
        show_agent_reach_hints = bool(
            agent_reach_connector and agent_reach_connector.get("enabled")
        ) or (enabled_skills and "agent-reach" in enabled_skills)

        if enabled:
            lines.append(
                "Enabled MCP connectors (use mcp_call with connector_id or catalog_id, tool_name, arguments):",
            )
            for connector in sorted(enabled, key=lambda row: row["name"]):
                tools = ", ".join(connector.get("tools", [])[:8])
                integration = connector.get("integration") or connector.get("transport", "http")
                note = connector.get("setup_note", "")
                catalog_id = connector.get("catalog_id") or ""
                catalog_hint = f" catalog_id={catalog_id}" if catalog_id else ""
                lines.append(
                    f"- {connector['name']} [{connector['connector_id']}]{catalog_hint} ({integration}): {tools}"
                )
                if note and integration != "native":
                    lines.append(f"  Setup: {note}")

        if show_agent_reach_hints:
            lines.extend(
                [
                    "",
                    "Agent Reach server tools (catalog_id=agent_reach when connector is enabled):",
                    "- fetch_web: readable article text via Jina Reader — arguments: {url}",
                    "- youtube_transcript: subtitle text — arguments: {url}",
                    "- rss_read: feed entries — arguments: {url, limit?}",
                    "- github_repo: public repo metadata — arguments: {repo: owner/name}",
                    "Social platforms (Twitter, Reddit, XHS) require local Agent Reach CLI — see agent-reach skill.",
                ]
            )

        return "\n".join(lines).strip()


context_mcp_service = ContextMcpService()
