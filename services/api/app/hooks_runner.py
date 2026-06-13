from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import httpx


ALLOWED_HOOK_COMMANDS = {
    "black",
    "ruff",
    "prettier",
    "eslint",
    "gofmt",
    "cargo",
    "npm",
    "npx",
    "pnpm",
    "yarn",
    "python",
    "pytest",
}

# Claude Code event names (FileChanged aliases legacy after_file_apply)
EVENT_ALIASES = {
    "after_file_apply": "FileChanged",
    "FileChanged": "FileChanged",
    "SessionStart": "SessionStart",
    "SessionEnd": "SessionEnd",
    "PreToolUse": "PreToolUse",
    "PostToolUse": "PostToolUse",
    "PermissionDenied": "PermissionDenied",
}

HOOKS_TEMPLATE = {
    "hooks": [
        {
            "event": "SessionStart",
            "type": "command",
            "command": "echo 'CodeForge session started'",
        },
        {
            "event": "FileChanged",
            "type": "command",
            "command": "npx prettier --write $CODEFORGE_HOOK_FILE",
            "match": "\\.(js|ts|jsx|tsx|json|md)$",
        },
        {
            "event": "PreToolUse",
            "type": "prompt",
            "tool": "run_shell",
            "prompt": "Verify shell command safety before execution.",
        },
        {
            "event": "PostToolUse",
            "type": "command",
            "command": "echo 'Tool completed'",
        },
        {
            "event": "PermissionDenied",
            "type": "prompt",
            "prompt": "Suggest a safer alternative approach.",
        },
    ]
}


def _project_hooks_path(project_path: str) -> Path:
    return Path(project_path).expanduser().resolve() / ".codeforge" / "hooks.json"


def write_hooks_template(project_path: str) -> str:
    path = _project_hooks_path(project_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file():
        path.write_text(json.dumps(HOOKS_TEMPLATE, indent=2) + "\n", encoding="utf-8")
    return str(path)


def load_hooks(project_path: str) -> dict[str, Any]:
    path = _project_hooks_path(project_path)
    if not path.is_file():
        return {"hooks": []}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"hooks": []}
    return payload if isinstance(payload, dict) else {"hooks": []}


def _normalize_event(event: str) -> str:
    return EVENT_ALIASES.get(event, event)


def _hook_matches(hook: dict[str, Any], event: str, *, tool_name: str | None = None, target_file: str | None = None) -> bool:
    if _normalize_event(str(hook.get("event", ""))) != _normalize_event(event):
        return False
    filter_tool = hook.get("tool")
    if filter_tool and tool_name and str(filter_tool) != tool_name:
        return False
    pattern = hook.get("match")
    if pattern and target_file:
        import re

        if not re.search(str(pattern), target_file):
            return False
    return True


def run_hooks(
    event: str,
    project_path: str,
    *,
    target_file: str | None = None,
    tool_name: str | None = None,
    tool_args: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    config = load_hooks(project_path)
    results: list[dict[str, Any]] = []
    for hook in config.get("hooks", []):
        if not isinstance(hook, dict):
            continue
        if not _hook_matches(hook, event, tool_name=tool_name, target_file=target_file):
            continue

        hook_type = str(hook.get("type", "command"))
        if hook_type == "command":
            results.append(_run_command_hook(hook, project_path, target_file=target_file))
        elif hook_type == "http":
            results.append(_run_http_hook(hook, tool_args=tool_args))
        elif hook_type == "mcp_tool":
            results.append(_run_mcp_hook(hook, user_id=user_id, tool_args=tool_args))
        elif hook_type == "prompt":
            results.append(_run_prompt_hook(hook, tool_name=tool_name, tool_args=tool_args))
        elif hook_type == "agent":
            results.append({"type": "agent", "status": "queued", "task": hook.get("task", ""), "note": "agent hooks run asynchronously"})
        else:
            results.append({"type": hook_type, "status": "skipped", "reason": "unknown hook type"})
    return results


def _run_command_hook(hook: dict[str, Any], project_path: str, *, target_file: str | None) -> dict[str, Any]:
    command = str(hook.get("command", "")).strip()
    if not command:
        return {"type": "command", "status": "skipped", "reason": "empty command"}
    exe = command.split()[0].lower().rstrip("$")
    if exe not in ALLOWED_HOOK_COMMANDS:
        return {"type": "command", "command": command, "status": "skipped", "reason": "not allowlisted"}
    cwd = Path(project_path).resolve()
    env = os.environ.copy()
    if target_file:
        env["CODEFORGE_HOOK_FILE"] = target_file
    completed = subprocess.run(
        command,
        shell=True,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    return {
        "type": "command",
        "command": command,
        "status": "completed" if completed.returncode == 0 else "failed",
        "exit_code": completed.returncode,
        "stdout": (completed.stdout or "")[:500],
        "stderr": (completed.stderr or "")[:500],
    }


def _run_http_hook(hook: dict[str, Any], *, tool_args: dict[str, Any] | None) -> dict[str, Any]:
    url = str(hook.get("url", "")).strip()
    if not url:
        return {"type": "http", "status": "skipped", "reason": "missing url"}
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, json={"arguments": tool_args or {}, "hook": hook})
        return {
            "type": "http",
            "url": url,
            "status": "completed" if response.status_code < 400 else "failed",
            "status_code": response.status_code,
            "body": response.text[:400],
        }
    except Exception as exc:
        return {"type": "http", "url": url, "status": "failed", "error": str(exc)}


def _run_mcp_hook(hook: dict[str, Any], *, user_id: str | None, tool_args: dict[str, Any] | None) -> dict[str, Any]:
    connector_id = str(hook.get("connector_id", "")).strip()
    mcp_tool = str(hook.get("tool_name", "")).strip()
    if not connector_id or not mcp_tool or not user_id:
        return {"type": "mcp_tool", "status": "skipped", "reason": "missing connector_id, tool_name, or user_id"}
    try:
        from .context_mcp import context_mcp_service

        payload = context_mcp_service.invoke_connector(
            user_id=user_id,
            connector_id=connector_id,
            tool_name=mcp_tool,
            arguments=tool_args or {},
        )
        return {"type": "mcp_tool", "status": "completed", "result": payload}
    except Exception as exc:
        return {"type": "mcp_tool", "status": "failed", "error": str(exc)}


def _run_prompt_hook(
    hook: dict[str, Any],
    *,
    tool_name: str | None,
    tool_args: dict[str, Any] | None,
) -> dict[str, Any]:
    prompt = str(hook.get("prompt", "")).strip()
    return {
        "type": "prompt",
        "status": "recorded",
        "prompt": prompt,
        "tool": tool_name,
        "arguments": tool_args or {},
        "message": "Prompt hook recorded for agent context.",
    }


def collect_prompt_hook_context(results: list[dict[str, Any]]) -> str:
    prompts = [
        str(row.get("prompt", "")).strip()
        for row in results
        if row.get("type") == "prompt" and row.get("status") == "recorded" and row.get("prompt")
    ]
    if not prompts:
        return ""
    return "Hook guidance:\n" + "\n".join(f"- {item}" for item in prompts)
