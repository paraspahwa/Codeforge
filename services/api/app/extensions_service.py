"""Install and manage Claude Code–style extensions."""

from __future__ import annotations

from typing import Any

from .agent_templates import agent_template_service
from .catalog_versions import catalog_version_for
from .extensions_catalog import (
    HOOK_EVENTS,
    HOOK_TYPES,
    get_extension,
    get_workflow_plugin,
    list_extension_categories,
    list_extensions,
)
from .lsp_plugins import list_lsp_status
from .skills_service import skills_service


class ExtensionsError(RuntimeError):
    pass


class ExtensionsService:
    def get_enabled_extensions(self, user_id: str) -> set[str]:
        prefs = skills_service.get_preferences(user_id)
        return set(prefs.get("enabled_extensions") or [])

    def _extension_versions(self, user_id: str) -> dict[str, str]:
        prefs = skills_service.get_preferences(user_id)
        raw = prefs.get("extension_versions") or {}
        return dict(raw) if isinstance(raw, dict) else {}

    def _save_extension_state(
        self,
        *,
        user_id: str,
        enabled_ids: set[str],
        versions: dict[str, str],
    ) -> None:
        prefs = skills_service.get_preferences(user_id)
        skills_service.update_preferences(
            user_id=user_id,
            caveman_mode=prefs["caveman_mode"],
            enabled_skills=prefs["enabled_skills"],
            enabled_extensions=sorted(enabled_ids),
            extension_versions=versions,
            rtk_enabled=prefs.get("rtk_enabled"),
            agent_engine=prefs.get("agent_engine"),
            permission_mode=prefs.get("permission_mode"),
            plan_mode_default=prefs.get("plan_mode_default"),
        )

    def _enrich_extension_row(self, row: dict[str, Any], *, enabled: set[str], versions: dict[str, str]) -> dict[str, Any]:
        item = dict(row)
        catalog_version = catalog_version_for(row)
        installed_version = versions.get(row["id"])
        item["catalog_version"] = catalog_version
        item["installed_version"] = installed_version
        item["enabled"] = row["id"] in enabled
        item["update_available"] = row["id"] in enabled and (
            not installed_version or installed_version != catalog_version
        )
        if row["kind"] == "lsp":
            from .lsp_plugins import check_lsp_binary, get_lsp_plugin

            plugin = get_lsp_plugin(row["id"])
            if plugin:
                binary = check_lsp_binary(plugin)
                item["binary_installed"] = binary["installed"]
                item["ready"] = row["id"] in enabled and binary["installed"]
        return item

    def list_catalog(self, *, user_id: str, category: str | None = None) -> dict[str, Any]:
        enabled = self.get_enabled_extensions(user_id)
        versions = self._extension_versions(user_id)
        extensions = [
            self._enrich_extension_row(row, enabled=enabled, versions=versions)
            for row in list_extensions(category=category)
        ]
        lsp_rows = list_lsp_status(enabled_ids=enabled)
        return {
            "categories": list_extension_categories(),
            "extensions": extensions,
            "lsp_plugins": lsp_rows,
            "hook_events": HOOK_EVENTS,
            "hook_types": HOOK_TYPES,
            "catalog_revision": catalog_version_for(),
            "total": len(extensions),
            "enabled_count": len(enabled),
        }

    def install_extension(self, *, user_id: str, extension_id: str, project_path: str | None = None) -> dict[str, Any]:
        ext = get_extension(extension_id)
        if ext is None:
            raise ExtensionsError(f"Unknown extension: {extension_id}")

        enabled = self.get_enabled_extensions(user_id)
        versions = self._extension_versions(user_id)
        catalog_version = catalog_version_for(ext)
        was_enabled = extension_id in enabled
        created_template = None
        hooks_template = None

        if ext["kind"] == "workflow":
            plugin = get_workflow_plugin(extension_id)
            if not plugin:
                raise ExtensionsError(f"Workflow plugin not found: {extension_id}")
            prefs = skills_service.get_preferences(user_id)
            skill_names = list(prefs.get("enabled_skills") or [])
            for skill in plugin.get("skills", []):
                if skill not in skill_names:
                    skill_names.append(skill)
            enabled.add(extension_id)
            versions[extension_id] = catalog_version
            skills_service.update_preferences(
                user_id=user_id,
                caveman_mode=prefs["caveman_mode"],
                enabled_skills=skill_names,
                enabled_extensions=sorted(enabled),
                extension_versions=versions,
                rtk_enabled=prefs.get("rtk_enabled"),
                agent_engine=prefs.get("agent_engine"),
                permission_mode=prefs.get("permission_mode"),
                plan_mode_default=prefs.get("plan_mode_default"),
            )
            existing = {template["name"]: template for template in agent_template_service.list_templates(user_id=user_id)}
            if plugin.get("template_name") and plugin["template_name"] not in existing:
                created_template = agent_template_service.create_template(
                    user_id=user_id,
                    name=plugin["template_name"],
                    description=plugin["description"],
                    prompt_prefix=plugin["template_prefix"],
                    verify_command=plugin.get("verify_command"),
                )
            return {
                "extension_id": extension_id,
                "enabled": True,
                "created": not was_enabled,
                "catalog_version": catalog_version,
                "installed_version": catalog_version,
                "update_available": False,
                "skills_enabled": plugin.get("skills", []),
                "template": created_template,
            }

        if ext["kind"] == "lsp":
            enabled.add(extension_id)
            versions[extension_id] = catalog_version
            prefs = skills_service.get_preferences(user_id)
            skills_service.update_preferences(
                user_id=user_id,
                caveman_mode=prefs["caveman_mode"],
                enabled_skills=prefs["enabled_skills"],
                enabled_extensions=sorted(enabled),
                extension_versions=versions,
                rtk_enabled=prefs.get("rtk_enabled"),
                agent_engine=prefs.get("agent_engine"),
                permission_mode=prefs.get("permission_mode"),
                plan_mode_default=prefs.get("plan_mode_default"),
            )
            from .lsp_plugins import check_lsp_binary, get_lsp_plugin

            plugin = get_lsp_plugin(extension_id)
            binary = check_lsp_binary(plugin) if plugin else {"installed": False}
            return {
                "extension_id": extension_id,
                "enabled": True,
                "created": not was_enabled,
                "catalog_version": catalog_version,
                "installed_version": catalog_version,
                "update_available": False,
                "binary_installed": binary.get("installed", False),
                "install_hint": plugin.get("install_hint") if plugin else "",
            }

        if ext["kind"] == "native" and extension_id == "hooks":
            from .hooks_runner import write_hooks_template

            if project_path:
                hooks_template = write_hooks_template(project_path)
            enabled.add(extension_id)
            versions[extension_id] = catalog_version
            prefs = skills_service.get_preferences(user_id)
            skills_service.update_preferences(
                user_id=user_id,
                caveman_mode=prefs["caveman_mode"],
                enabled_skills=prefs["enabled_skills"],
                enabled_extensions=sorted(enabled),
                extension_versions=versions,
                rtk_enabled=prefs.get("rtk_enabled"),
                agent_engine=prefs.get("agent_engine"),
                permission_mode=prefs.get("permission_mode"),
                plan_mode_default=prefs.get("plan_mode_default"),
            )
            return {
                "extension_id": extension_id,
                "enabled": True,
                "created": not was_enabled,
                "catalog_version": catalog_version,
                "installed_version": catalog_version,
                "update_available": False,
                "hooks_template": hooks_template,
            }

        if ext["kind"] == "native":
            enabled.add(extension_id)
            versions[extension_id] = catalog_version
            prefs = skills_service.get_preferences(user_id)
            skills_service.update_preferences(
                user_id=user_id,
                caveman_mode=prefs["caveman_mode"],
                enabled_skills=prefs["enabled_skills"],
                enabled_extensions=sorted(enabled),
                extension_versions=versions,
                rtk_enabled=prefs.get("rtk_enabled"),
                agent_engine=prefs.get("agent_engine"),
                permission_mode=prefs.get("permission_mode"),
                plan_mode_default=prefs.get("plan_mode_default"),
            )
            return {
                "extension_id": extension_id,
                "enabled": True,
                "created": not was_enabled,
                "catalog_version": catalog_version,
                "installed_version": catalog_version,
                "update_available": False,
                "setup_note": ext.get("setup_note", ""),
            }

        raise ExtensionsError(f"Extension kind not installable: {ext['kind']}")

    def disable_extension(self, *, user_id: str, extension_id: str) -> dict[str, Any]:
        ext = get_extension(extension_id)
        if ext is None:
            raise ExtensionsError(f"Unknown extension: {extension_id}")
        enabled = self.get_enabled_extensions(user_id)
        if extension_id not in enabled:
            return {"extension_id": extension_id, "enabled": False, "removed": False}
        enabled.discard(extension_id)
        versions = self._extension_versions(user_id)
        versions.pop(extension_id, None)
        self._save_extension_state(user_id=user_id, enabled_ids=enabled, versions=versions)
        return {"extension_id": extension_id, "enabled": False, "removed": True}

    def update_extension(self, *, user_id: str, extension_id: str, project_path: str | None = None) -> dict[str, Any]:
        if extension_id not in self.get_enabled_extensions(user_id):
            raise ExtensionsError("Enable the extension before updating")
        ext = get_extension(extension_id)
        if ext is None:
            raise ExtensionsError(f"Unknown extension: {extension_id}")
        catalog_version = catalog_version_for(ext)
        installed_version = self._extension_versions(user_id).get(extension_id)
        if installed_version == catalog_version:
            return {
                "extension_id": extension_id,
                "enabled": True,
                "updated": False,
                "catalog_version": catalog_version,
                "installed_version": installed_version,
                "update_available": False,
            }
        result = self.install_extension(user_id=user_id, extension_id=extension_id, project_path=project_path)
        result["updated"] = True
        result["update_available"] = False
        return result

    def install_all_lsp(self, *, user_id: str) -> dict[str, Any]:
        from .extensions_catalog import LSP_PLUGINS

        installed = 0
        for plugin in LSP_PLUGINS:
            result = self.install_extension(user_id=user_id, extension_id=plugin["id"])
            if result.get("enabled"):
                installed += 1
        return {"installed": installed, "total": len(LSP_PLUGINS)}


extensions_service = ExtensionsService()
