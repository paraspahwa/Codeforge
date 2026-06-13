"""LSP plugin registry — binary detection and language routing."""

from __future__ import annotations

import shutil
from typing import Any

from .extensions_catalog import LSP_PLUGINS, get_lsp_plugin


def _binary_available(name: str) -> bool:
    return shutil.which(name) is not None


def check_lsp_binary(plugin: dict[str, Any]) -> dict[str, Any]:
    primary = str(plugin.get("binary", ""))
    found = _binary_available(primary)
    resolved = primary if found else None
    if not found:
        for alt in plugin.get("binary_alternatives", []):
            if _binary_available(str(alt)):
                found = True
                resolved = str(alt)
                break
    return {
        "binary": primary,
        "resolved_binary": resolved,
        "installed": found,
        "install_hint": plugin.get("install_hint", ""),
    }


def list_lsp_status(*, enabled_ids: set[str] | None = None) -> list[dict[str, Any]]:
    enabled = enabled_ids or set()
    rows = []
    for plugin in LSP_PLUGINS:
        binary_status = check_lsp_binary(plugin)
        rows.append({
            "id": plugin["id"],
            "name": plugin["name"],
            "language": plugin["language"],
            "binary": plugin["binary"],
            "package": plugin.get("package"),
            "install_hint": plugin.get("install_hint", ""),
            "installed": binary_status["installed"],
            "resolved_binary": binary_status["resolved_binary"],
            "enabled": plugin["id"] in enabled,
            "ready": plugin["id"] in enabled and binary_status["installed"],
        })
    return rows


def pick_lsp_for_path(path: str, *, enabled_ids: set[str]) -> dict[str, Any] | None:
    suffix = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    mapping = {
        "ts": "typescript-lsp",
        "tsx": "typescript-lsp",
        "js": "typescript-lsp",
        "jsx": "typescript-lsp",
        "mjs": "typescript-lsp",
        "cjs": "typescript-lsp",
        "py": "pyright-lsp",
        "pyi": "pyright-lsp",
        "rs": "rust-analyzer-lsp",
        "go": "gopls-lsp",
        "c": "clangd-lsp",
        "cc": "clangd-lsp",
        "cpp": "clangd-lsp",
        "h": "clangd-lsp",
        "hpp": "clangd-lsp",
        "cs": "csharp-lsp",
        "java": "jdtls-lsp",
        "kt": "kotlin-lsp",
        "kts": "kotlin-lsp",
        "lua": "lua-lsp",
        "php": "php-lsp",
        "swift": "swift-lsp",
    }
    plugin_id = mapping.get(suffix)
    if not plugin_id or plugin_id not in enabled_ids:
        return None
    plugin = get_lsp_plugin(plugin_id)
    if not plugin:
        return None
    status = check_lsp_binary(plugin)
    if not status["installed"]:
        return None
    return {**plugin, "resolved_binary": status["resolved_binary"]}
