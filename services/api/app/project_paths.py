from __future__ import annotations

import os
from pathlib import Path


def normalize_project_path(project_path: str) -> str:
    """Map host workspace paths to container-mounted paths when configured."""
    raw = (project_path or "").strip()
    if not raw:
        return raw

    host_prefix = os.getenv("CODEFORGE_WORKSPACES_HOST_PREFIX", "").strip()
    container_prefix = os.getenv("CODEFORGE_WORKSPACES_CONTAINER_PREFIX", "/workspaces").strip() or "/workspaces"
    if not host_prefix:
        return str(Path(raw).expanduser().resolve())

    host_root = Path(host_prefix).expanduser().resolve()
    candidate = Path(raw).expanduser()
    resolved = candidate.resolve() if candidate.is_absolute() else (host_root / candidate).resolve()

    try:
        relative = resolved.relative_to(host_root)
    except ValueError:
        return str(resolved)

    mapped = Path(container_prefix) / relative
    return mapped.as_posix() if os.name != "nt" else str(mapped).replace("\\", "/")


def resolved_project_path(session: dict[str, object]) -> str:
    return normalize_project_path(str(session["project_path"]))
