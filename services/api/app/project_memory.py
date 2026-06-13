from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any


MEMORY_FILENAMES = ("CLAUDE.md", "CODEFORGE.md", ".codeforge/AGENTS.md")


def load_project_memory(project_path: str) -> tuple[str, str | None]:
    root = Path(project_path).expanduser().resolve()
    for candidate in MEMORY_FILENAMES:
        path = root / candidate
        if path.is_file():
            try:
                return path.read_text(encoding="utf-8").strip(), candidate
            except OSError:
                continue
    return "", None


def compose_project_memory_context(project_path: str) -> str:
    content, source = load_project_memory(project_path)
    if not content:
        return ""
    clipped = content[:6000]
    if len(content) > 6000:
        clipped += "\n\n...[project memory truncated]"
    return f"Project memory ({source}):\n{clipped}"
