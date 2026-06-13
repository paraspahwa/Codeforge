from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from .cowork_file_ops import build_organize_moves, build_rename_operations, preview_organize_by_date, preview_rename_pattern


def _detect_folder(goal: str, default: str = ".") -> str:
    quoted = re.findall(r"[`'\"]([^`'\"]+)[`'\"]", goal)
    if quoted:
        return quoted[0]
    for token in goal.split():
        if "/" in token or token.endswith((".md", ".pdf", ".txt", ".csv")):
            return token.strip(".,;")
    return default


def plan_from_goal(goal: str, *, project_path: str, session_id: str) -> dict[str, Any]:
    """Turn a natural-language Cowork goal into a preview-first multi-step workflow."""
    cleaned = goal.strip()
    if not cleaned:
        raise ValueError("Cowork goal cannot be empty")

    lowered = cleaned.lower()
    workflow_id = f"cw_flow_{uuid4().hex[:10]}"
    steps: list[dict[str, Any]] = []
    preview_lines: list[str] = []

    folder = _detect_folder(cleaned)

    if any(token in lowered for token in ("organize", "sort files", "clean up", "cleanup", "tidy")):
        preview = preview_organize_by_date(project_path, folder)
        steps.append(
            {
                "step_id": f"step_{len(steps) + 1}",
                "task_type": "file_ops",
                "title": f"Organize files in {folder} by date",
                "action": "organize_by_date",
                "source_path": folder,
                "operations": build_organize_moves(project_path, folder),
                "preview": preview,
            }
        )
        preview_lines.append(f"Organize {preview['move_count']} file(s) in `{folder}` into date folders")

    if any(token in lowered for token in ("rename", "standardize names", "naming")):
        preview = preview_rename_pattern(project_path, folder, replace_spaces=True)
        steps.append(
            {
                "step_id": f"step_{len(steps) + 1}",
                "task_type": "file_ops",
                "title": f"Rename files in {folder}",
                "action": "rename_pattern",
                "source_path": folder,
                "operations": build_rename_operations(project_path, folder, replace_spaces=True),
                "preview": preview,
            }
        )
        preview_lines.append(f"Rename {preview['rename_count']} file(s) in `{folder}`")

    if any(token in lowered for token in ("extract", "ocr", "read all", "scan", "pull text")):
        steps.append(
            {
                "step_id": f"step_{len(steps) + 1}",
                "task_type": "extract",
                "title": f"Extract text from {folder}",
                "source_path": folder if folder != "." else "README.md",
            }
        )
        preview_lines.append(f"Extract structured text from `{folder}`")

    if any(token in lowered for token in ("scrape", "fetch url", "crawl", "http")):
        url_match = re.search(r"https?://[^\s]+", cleaned)
        steps.append(
            {
                "step_id": f"step_{len(steps) + 1}",
                "task_type": "scrape",
                "title": "Scrape web content",
                "url": url_match.group(0) if url_match else "https://example.com",
                "scrape_prompt": cleaned[:500],
                "requires_approval": True,
            }
        )
        preview_lines.append("Scrape and ingest web page content (approval required)")

    if any(token in lowered for token in ("report", "synthesize", "summary", "summarize", "brief", "analysis")):
        steps.append(
            {
                "step_id": f"step_{len(steps) + 1}",
                "task_type": "synthesize",
                "title": "Synthesize document report",
                "source_path": folder,
                "output_name": "cowork-report.md",
                "prompt": cleaned,
            }
        )
        preview_lines.append("Synthesize a markdown report from extracted workspace content")

    if any(token in lowered for token in ("pytest", "npm test", "run ", "execute ", "shell", "test ")):
        command = cleaned
        for prefix in ("run ", "execute ", "shell "):
            if lowered.startswith(prefix):
                command = cleaned[len(prefix) :].strip()
                break
        steps.append(
            {
                "step_id": f"step_{len(steps) + 1}",
                "task_type": "shell",
                "title": "Run sandboxed command",
                "command": command[:200],
            }
        )
        preview_lines.append(f"Run command: `{command[:80]}`")

    if any(token in lowered for token in ("browser", "screenshot", "open url", "visit ")):
        url_match = re.search(r"https?://[^\s]+", cleaned)
        steps.append(
            {
                "step_id": f"step_{len(steps) + 1}",
                "task_type": "browser",
                "title": "Browser capture task",
                "url": url_match.group(0) if url_match else "https://example.com",
                "browser_action": "capture_screenshot" if "screenshot" in lowered else "capture_title",
                "requires_approval": True,
            }
        )
        preview_lines.append("Browser automation with user approval")

    if not steps:
        steps.append(
            {
                "step_id": "step_1",
                "task_type": "shell",
                "title": "Inspect workspace",
                "command": "ls -la" if folder == "." else f"ls -la {folder}",
            }
        )
        preview_lines.append("List workspace files to understand the task scope")

    requires_approval = any(step.get("requires_approval") for step in steps) or any(
        step["task_type"] in {"browser", "scrape", "file_ops"} for step in steps
    )

    return {
        "workflow_id": workflow_id,
        "session_id": session_id,
        "project_path": project_path,
        "goal": cleaned,
        "step_count": len(steps),
        "steps": steps,
        "preview_lines": preview_lines,
        "requires_approval": requires_approval,
        "autonomous": True,
    }
