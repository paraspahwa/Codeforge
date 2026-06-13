from __future__ import annotations

import asyncio
from typing import Any

from .agent import build_agent_run
from .agent_tools import ToolContext, execute_tool


_MAX_CONCURRENT = 3
_active: dict[str, int] = {}


async def spawn_subagent_task(
    *,
    session_id: str,
    user_id: str,
    project_path: str,
    task: str,
    scope: str | None = None,
) -> dict[str, Any]:
    cleaned = task.strip()
    if not cleaned:
        return {"summary": "Subagent task was empty", "status": "error"}

    key = session_id
    if _active.get(key, 0) >= _MAX_CONCURRENT:
        return {"summary": "Subagent concurrency limit reached", "status": "blocked"}

    _active[key] = _active.get(key, 0) + 1
    try:
        ctx = ToolContext(
            session_id=session_id,
            user_id=user_id,
            project_path=project_path,
            current_file=scope,
        )
        read_result = None
        if scope:
            read_result = await execute_tool("read_file", {"path": scope}, ctx)

        run = await build_agent_run(
            prompt=cleaned,
            session_id=session_id,
            project_path=project_path,
            current_file=scope,
        )
        summary_parts = [f"Subagent completed: {cleaned[:80]}"]
        if read_result and read_result.status == "completed":
            summary_parts.append(f"Scoped to {scope}")
        if run.target_file:
            summary_parts.append(f"Edited {run.target_file}")
        return {
            "summary": " · ".join(summary_parts),
            "status": "completed",
            "target_file": run.target_file,
            "assistant_excerpt": run.assistant_message[:500],
        }
    finally:
        _active[key] = max(0, _active.get(key, 1) - 1)
