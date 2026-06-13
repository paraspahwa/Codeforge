from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any


ALLOWED_HOOK_COMMANDS = {
    "black",
    "ruff",
    "prettier",
    "eslint",
    "gofmt",
    "cargo",
    "npm",
    "npx",
}


def _project_hooks_path(project_path: str) -> Path:
    return Path(project_path).expanduser().resolve() / ".codeforge" / "hooks.json"


def load_hooks(project_path: str) -> dict[str, Any]:
    path = _project_hooks_path(project_path)
    if not path.is_file():
        return {"hooks": []}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"hooks": []}
    return payload if isinstance(payload, dict) else {"hooks": []}


def run_hooks(event: str, project_path: str, *, target_file: str | None = None) -> list[dict[str, Any]]:
    config = load_hooks(project_path)
    results: list[dict[str, Any]] = []
    for hook in config.get("hooks", []):
        if not isinstance(hook, dict):
            continue
        if hook.get("event") != event:
            continue
        command = str(hook.get("command", "")).strip()
        if not command:
            continue
        exe = command.split()[0].lower()
        if exe not in ALLOWED_HOOK_COMMANDS:
            results.append({"command": command, "status": "skipped", "reason": "not allowlisted"})
            continue
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
        results.append(
            {
                "command": command,
                "status": "completed" if completed.returncode == 0 else "failed",
                "exit_code": completed.returncode,
                "stdout": (completed.stdout or "")[:500],
                "stderr": (completed.stderr or "")[:500],
            }
        )
    return results
