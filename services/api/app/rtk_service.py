from __future__ import annotations

import os
import shlex
import shutil
from pathlib import Path
from typing import Any

_GIT_READONLY = {"status", "diff", "log"}
_NPM_SAFE = {"test", "run", "exec", "build", "lint", "check"}
_PYTHON_MODULES = {"pytest", "unittest"}
_CARGO_SAFE = {"test", "check", "build", "fmt", "clippy"}
_DOTNET_SAFE = {"test", "build", "run", "restore", "format"}


def rtk_binary_path() -> str | None:
    configured = os.getenv("CODEFORGE_RTK_BINARY", "").strip()
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.is_file():
            return str(candidate.resolve())
    resolved = shutil.which("rtk")
    return resolved


def env_rtk_enabled() -> bool:
    return os.getenv("CODEFORGE_RTK_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def rtk_debug_enabled() -> bool:
    return os.getenv("CODEFORGE_RTK_DEBUG", "false").strip().lower() in {"1", "true", "yes", "on"}


def is_rtk_supported_command(command: str) -> bool:
    normalized = " ".join(command.strip().split())
    if not normalized:
        return False
    try:
        parts = shlex.split(normalized, posix=False)
    except ValueError:
        return False
    if not parts:
        return False

    exe = parts[0].lower()
    rest = [part.lower() for part in parts[1:]]

    if exe == "git" and rest and rest[0] in _GIT_READONLY:
        return True
    if exe in {"pytest", "rg", "cargo", "dotnet", "npm", "pnpm", "yarn", "python", "py"}:
        if exe == "cargo" and rest and rest[0] in _CARGO_SAFE:
            return True
        if exe == "dotnet" and rest and rest[0] in _DOTNET_SAFE:
            return True
        if exe in {"npm", "pnpm", "yarn"} and rest and rest[0] in _NPM_SAFE:
            return True
        if exe == "pytest":
            return True
        if exe in {"python", "py"} and len(rest) >= 2 and rest[0] == "-m" and rest[1] in _PYTHON_MODULES:
            return True
        if exe == "rg":
            return True
    return False


def should_apply_rtk(command: str, *, user_rtk_enabled: bool | None = None) -> bool:
    if user_rtk_enabled is False:
        return False
    if user_rtk_enabled is None and not env_rtk_enabled():
        return False
    if not rtk_binary_path():
        return False
    return is_rtk_supported_command(command)


def build_rtk_argv(command: str) -> list[str]:
    rtk_path = rtk_binary_path()
    if not rtk_path:
        raise RuntimeError("rtk binary is not available")
    parts = shlex.split(" ".join(command.strip().split()), posix=False)
    return [rtk_path, *parts]


def build_shell_summary(output: str, exit_code: int, *, rtk_applied: bool) -> str:
    if output:
        if rtk_applied:
            return output[:8000]
        return output[-1200:]
    return f"exit_code={exit_code}"


def compute_savings_metrics(*, raw_bytes: int, filtered_bytes: int) -> dict[str, Any]:
    savings_pct = 0.0
    if raw_bytes > 0 and filtered_bytes >= 0:
        savings_pct = max(0.0, min(100.0, (1 - (filtered_bytes / raw_bytes)) * 100))
    return {
        "raw_bytes": raw_bytes,
        "filtered_bytes": filtered_bytes,
        "savings_pct": round(savings_pct, 1),
    }


def estimate_raw_bytes(filtered_bytes: int, output_lines: int) -> int:
    if filtered_bytes <= 0:
        return 0
    line_estimate = max(filtered_bytes, output_lines * 96)
    return int(line_estimate * 3.5)


def build_rtk_stats(
    *,
    command: str,
    filtered_bytes: int,
    output_lines: int,
    rtk_applied: bool,
) -> dict[str, Any]:
    if not rtk_applied:
        return {
            "command": command,
            "rtk_applied": False,
            "raw_bytes": filtered_bytes,
            "filtered_bytes": filtered_bytes,
            "savings_pct": 0.0,
            "output_lines": output_lines,
        }
    raw_bytes = estimate_raw_bytes(filtered_bytes, output_lines)
    metrics = compute_savings_metrics(raw_bytes=raw_bytes, filtered_bytes=filtered_bytes)
    return {
        "command": command,
        "rtk_applied": True,
        "output_lines": output_lines,
        **metrics,
    }
