from __future__ import annotations

import asyncio
import re
import shutil
import shlex
from pathlib import Path
from typing import Any, AsyncIterator

from .rtk_service import (
    build_rtk_argv,
    build_rtk_stats,
    build_shell_summary,
    rtk_debug_enabled,
    should_apply_rtk,
)
from .tracing import add_span_event, set_span_attributes, traced_span


class ShellError(RuntimeError):
    pass


_BLOCKED_SYMBOLS = re.compile(r"[;&|><`\n\r]")
_BLOCKED_PATTERNS = [
    re.compile(r"\$\("),
    re.compile(r"(?i)\b(?:rm|del|erase|rmdir|rd|move|mv|copy|cp|ren|rename|sudo|invoke-expression|iex|start-process|remove-item|set-content|out-file|add-content|new-item)\b"),
]

_ALLOWED_SIMPLE_COMMANDS = {
    "pwd",
    "get-location",
    "dir",
    "ls",
    "get-childitem",
    "echo",
    "write-output",
    "cat",
    "type",
    "get-content",
    "rg",
    "findstr",
    "pytest",
}

_ALLOWED_NPM_SUBCOMMANDS = {"run", "test", "exec", "start", "build", "lint", "check", "list", "why", "view", "info"}
_ALLOWED_DOTNET_SUBCOMMANDS = {"test", "build", "run", "restore", "format"}
_ALLOWED_CARGO_SUBCOMMANDS = {"test", "check", "build", "fmt", "clippy"}


def _normalize_project_path(project_path: str) -> Path:
    root = Path(project_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ShellError("Project path does not exist")
    return root


def _parse_command(command: str) -> list[str]:
    normalized = " ".join(command.strip().split())
    if not normalized:
        raise ShellError("Command cannot be empty")

    if _BLOCKED_SYMBOLS.search(normalized):
        raise ShellError("Command contains blocked shell operators")

    for pattern in _BLOCKED_PATTERNS:
        if pattern.search(normalized):
            raise ShellError("Command is blocked by the shell sandbox")

    try:
        parts = shlex.split(normalized, posix=False)
    except ValueError as exc:
        raise ShellError("Command could not be parsed") from exc

    if not parts:
        raise ShellError("Command cannot be empty")

    return parts


def _validate_shell_command(command: str) -> str:
    parts = _parse_command(command)
    exe = parts[0].lower()
    rest = [part.lower() for part in parts[1:]]

    if exe in _ALLOWED_SIMPLE_COMMANDS:
        return " ".join(parts)

    if exe in {"npm", "pnpm", "yarn"}:
        if not rest or rest[0] not in _ALLOWED_NPM_SUBCOMMANDS:
            raise ShellError("Only safe package-manager commands are allowed")
        return " ".join(parts)

    if exe in {"python", "py"}:
        if len(rest) >= 3 and rest[0] == "-m" and rest[1] in {"pytest", "unittest", "compileall", "py_compile"}:
            return " ".join(parts)
        raise ShellError("Only test-oriented Python commands are allowed")

    if exe == "dotnet":
        if not rest or rest[0] not in _ALLOWED_DOTNET_SUBCOMMANDS:
            raise ShellError("Only build/test dotnet commands are allowed")
        return " ".join(parts)

    if exe == "cargo":
        if not rest or rest[0] not in _ALLOWED_CARGO_SUBCOMMANDS:
            raise ShellError("Only build/test cargo commands are allowed")
        return " ".join(parts)

    if exe == "git":
        if not rest:
            raise ShellError("Only read-only git commands are allowed in the shell sandbox")

        if rest[0] in {"status", "diff", "log"}:
            return " ".join(parts)

        if rest[0] == "branch" and rest[1:] == ["--show-current"]:
            return " ".join(parts)

        if rest[0] == "rev-parse" and rest[1:] == ["--abbrev-ref", "head"]:
            return " ".join(parts)

        raise ShellError("Only read-only git commands are allowed in the shell sandbox")

    raise ShellError("Command is not allowed in the shell sandbox")


def _resolve_shell_executable() -> str:
    for candidate in ("pwsh", "powershell"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise ShellError("PowerShell is not available")


def prepare_shell_execution(
    project_path: str,
    command: str,
    *,
    user_rtk_enabled: bool | None = None,
) -> tuple[Path, str, str, bool]:
    root = _normalize_project_path(project_path)
    sanitized = _validate_shell_command(command)
    rtk_applied = should_apply_rtk(sanitized, user_rtk_enabled=user_rtk_enabled)
    if rtk_applied:
        return root, sanitized, "rtk", True
    shell_executable = _resolve_shell_executable()
    return root, sanitized, shell_executable, False


async def _run_subprocess_collect(
    *,
    argv: list[str],
    cwd: Path,
    timeout_seconds: int,
    shell_mode: bool,
) -> tuple[str, int, int]:
    if shell_mode:
        process = await asyncio.create_subprocess_exec(
            argv[0],
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            argv[1],
            cwd=str(cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
    else:
        process = await asyncio.create_subprocess_exec(
            *argv,
            cwd=str(cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

    if process.stdout is None:
        raise ShellError("Unable to capture shell output")

    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_seconds
    output_chunks: list[str] = []
    output_lines = 0

    try:
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                process.kill()
                await process.wait()
                raise ShellError("Shell command timed out")

            try:
                chunk = await asyncio.wait_for(process.stdout.readline(), timeout=remaining)
            except asyncio.TimeoutError as exc:
                process.kill()
                await process.wait()
                raise ShellError("Shell command timed out") from exc

            if not chunk:
                break

            text = chunk.decode("utf-8", errors="replace").rstrip("\r\n")
            if text:
                output_chunks.append(text)
                output_lines += 1

        exit_code = await process.wait()
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()
            exit_code = -1

    output = "\n".join(output_chunks)
    return output, exit_code, output_lines


async def run_shell_command(
    project_path: str,
    command: str,
    timeout_seconds: int = 30,
    *,
    user_id: str | None = None,
    user_rtk_enabled: bool | None = None,
) -> dict[str, Any]:
    """Run a sandboxed shell command and collect stdout for verification loops."""
    from .skills_service import skills_service

    resolved_rtk = user_rtk_enabled
    if resolved_rtk is None and user_id:
        resolved_rtk = skills_service.resolve_rtk_enabled(user_id)

    root, sanitized, executable, rtk_applied = prepare_shell_execution(
        project_path,
        command,
        user_rtk_enabled=resolved_rtk,
    )

    if rtk_applied:
        argv = build_rtk_argv(sanitized)
        output, exit_code, output_lines = await _run_subprocess_collect(
            argv=argv,
            cwd=root,
            timeout_seconds=timeout_seconds,
            shell_mode=False,
        )
    else:
        output, exit_code, output_lines = await _run_subprocess_collect(
            argv=[executable, sanitized],
            cwd=root,
            timeout_seconds=timeout_seconds,
            shell_mode=True,
        )

    if rtk_applied and exit_code != 0 and rtk_debug_enabled() and not output:
        fallback_output, fallback_exit, fallback_lines = await _run_subprocess_collect(
            argv=[_resolve_shell_executable(), sanitized],
            cwd=root,
            timeout_seconds=timeout_seconds,
            shell_mode=True,
        )
        if fallback_output:
            output = f"{output}\n\n[rtk debug raw tail]\n{fallback_output[-1200:]}"
            output_lines = max(output_lines, fallback_lines)
            exit_code = fallback_exit

    filtered_bytes = len(output.encode("utf-8"))
    rtk_stats = build_rtk_stats(
        command=sanitized,
        filtered_bytes=filtered_bytes,
        output_lines=output_lines,
        rtk_applied=rtk_applied,
    )

    if user_id and rtk_applied:
        skills_service.record_rtk_stats(user_id, rtk_stats)

    summary = build_shell_summary(output, exit_code, rtk_applied=rtk_applied)
    return {
        "command": sanitized,
        "cwd": root.as_posix(),
        "exit_code": exit_code,
        "timed_out": False,
        "output": output,
        "summary": summary,
        "passed": exit_code == 0,
        "rtk_applied": rtk_applied,
        **rtk_stats,
    }


async def stream_shell_execution(
    project_path: str,
    command: str,
    timeout_seconds: int = 30,
    *,
    user_id: str | None = None,
    user_rtk_enabled: bool | None = None,
) -> AsyncIterator[dict[str, Any]]:
    from .skills_service import skills_service

    resolved_rtk = user_rtk_enabled
    if resolved_rtk is None and user_id:
        resolved_rtk = skills_service.resolve_rtk_enabled(user_id)

    root, sanitized, executable, rtk_applied = prepare_shell_execution(
        project_path,
        command,
        user_rtk_enabled=resolved_rtk,
    )

    with traced_span(
        "codeforge.shell.stream_execution",
        {
            "codeforge.shell.command": sanitized,
            "codeforge.shell.cwd": root.as_posix(),
            "codeforge.shell.timeout_seconds": timeout_seconds,
            "codeforge.shell.rtk_applied": rtk_applied,
        },
    ):
        yield {
            "type": "shell_call",
            "payload": {
                "command": sanitized,
                "cwd": root.as_posix(),
                "rtk_applied": rtk_applied,
            },
        }
        add_span_event("shell.command_started", {"command": sanitized, "rtk_applied": rtk_applied})

        if rtk_applied:
            process = await asyncio.create_subprocess_exec(
                *build_rtk_argv(sanitized),
                cwd=str(root),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
        else:
            process = await asyncio.create_subprocess_exec(
                executable,
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                sanitized,
                cwd=str(root),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

        if process.stdout is None:
            raise ShellError("Unable to capture shell output")

        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout_seconds
        output_lines = 0
        collected: list[str] = []

        try:
            while True:
                remaining = deadline - loop.time()
                if remaining <= 0:
                    process.kill()
                    await process.wait()
                    set_span_attributes({"codeforge.shell.timed_out": True})
                    raise ShellError("Shell command timed out")

                try:
                    chunk = await asyncio.wait_for(process.stdout.readline(), timeout=remaining)
                except asyncio.TimeoutError as exc:
                    process.kill()
                    await process.wait()
                    set_span_attributes({"codeforge.shell.timed_out": True})
                    raise ShellError("Shell command timed out") from exc

                if not chunk:
                    break

                text = chunk.decode("utf-8", errors="replace").rstrip("\r\n")
                if not text:
                    continue

                output_lines += 1
                collected.append(text)
                if output_lines <= 5:
                    add_span_event("shell.output", {"content": text[:240]})
                yield {
                    "type": "shell_output",
                    "payload": {
                        "stream": "stdout",
                        "content": text,
                    },
                }

            exit_code = await process.wait()
            output = "\n".join(collected)
            filtered_bytes = len(output.encode("utf-8"))
            rtk_stats = build_rtk_stats(
                command=sanitized,
                filtered_bytes=filtered_bytes,
                output_lines=output_lines,
                rtk_applied=rtk_applied,
            )
            if user_id and rtk_applied:
                skills_service.record_rtk_stats(user_id, rtk_stats)

            set_span_attributes(
                {
                    "codeforge.shell.exit_code": exit_code,
                    "codeforge.shell.output_lines": output_lines,
                    "codeforge.shell.timed_out": False,
                    "codeforge.shell.rtk_applied": rtk_applied,
                }
            )
            add_span_event(
                "shell.command_finished",
                {"exit_code": exit_code, "output_lines": output_lines, "rtk_applied": rtk_applied},
            )
            yield {
                "type": "shell_result",
                "payload": {
                    "command": sanitized,
                    "cwd": root.as_posix(),
                    "exit_code": exit_code,
                    "timed_out": False,
                    "output_lines": output_lines,
                    "rtk_applied": rtk_applied,
                    **rtk_stats,
                },
            }
        finally:
            if process.returncode is None:
                process.kill()
                await process.wait()
