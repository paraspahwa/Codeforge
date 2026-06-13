"""Catalog revision tracking for extensions and MCP servers."""

from __future__ import annotations

# Bump when catalog definitions change — triggers Update buttons for enabled items.
CATALOG_REVISION = "2025.06.13.2"


def catalog_version_for(item: dict | None = None) -> str:
    if item and item.get("version"):
        return str(item["version"])
    return CATALOG_REVISION


def update_available(*, installed_version: str | None, catalog_version: str) -> bool:
    if not installed_version:
        return False
    return installed_version != catalog_version
