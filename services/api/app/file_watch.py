from __future__ import annotations

import asyncio
import hashlib
from typing import AsyncIterator

from .file_ops import list_workspace_files, read_file_content


def _snapshot(project_path: str) -> dict[str, str]:
    digest: dict[str, str] = {}
    for relative_path in list_workspace_files(project_path, max_files=400):
        content = read_file_content(project_path, relative_path)
        digest[relative_path] = hashlib.sha1(content.encode("utf-8", errors="ignore")).hexdigest()
    return digest


async def watch_workspace_changes(project_path: str, *, interval_seconds: float = 2.0) -> AsyncIterator[list[dict[str, str]]]:
    previous = _snapshot(project_path)
    yield []
    while True:
        await asyncio.sleep(interval_seconds)
        current = _snapshot(project_path)
        events: list[dict[str, str]] = []
        for path, file_hash in current.items():
            if path not in previous:
                events.append({"path": path, "event": "created"})
            elif previous[path] != file_hash:
                events.append({"path": path, "event": "changed"})
        for path in previous:
            if path not in current:
                events.append({"path": path, "event": "deleted"})
        previous = current
        if events:
            yield events
