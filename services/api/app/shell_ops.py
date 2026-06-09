from __future__ import annotations

import asyncio
import re
import shutil
import shlex
from pathlib import Path
from typing import Any, AsyncIterator

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


def prepare_shell_execution(project_path: str, command: str) -> tuple[Path, str, str]:
    root = _normalize_project_path(project_path)
    sanitized = _validate_shell_command(command)
    shell_executable = _resolve_shell_executable()
    return root, sanitized, shell_executable


async def run_shell_command(
    project_path: str,
    command: str,
    timeout_seconds: int = 30,
) -> dict[str, Any]:
    """Run a sandboxed shell command and collect stdout for verification loops."""
    root, sanitized, shell_executable = prepare_shell_execution(project_path, command)

    process = await asyncio.create_subprocess_exec(
        shell_executable,
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
    output_chunks: list[str] = []
    exit_code = -1

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

        exit_code = await process.wait()
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()
            exit_code = -1

    output = "\n".join(output_chunks)
    tail = output[-1200:] if output else ""
    return {
        "command": sanitized,
        "cwd": root.as_posix(),
        "exit_code": exit_code,
        "timed_out": False,
        "output": output,
        "summary": tail or f"exit_code={exit_code}",
        "passed": exit_code == 0,
    }


async def stream_shell_execution(
    project_path: str,
    command: str,
    timeout_seconds: int = 30,
) -> AsyncIterator[dict[str, Any]]:
    root, sanitized, shell_executable = prepare_shell_execution(project_path, command)

    with traced_span(
        "codeforge.shell.stream_execution",
        {
            "codeforge.shell.command": sanitized,
            "codeforge.shell.cwd": root.as_posix(),
            "codeforge.shell.timeout_seconds": timeout_seconds,
        },
    ):
        yield {
            "type": "shell_call",
            "payload": {
                "command": sanitized,
                "cwd": root.as_posix(),
            },
        }
        add_span_event("shell.command_started", {"command": sanitized})

        process = await asyncio.create_subprocess_exec(
            shell_executable,
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
            set_span_attributes(
                {
                    "codeforge.shell.exit_code": exit_code,
                    "codeforge.shell.output_lines": output_lines,
                    "codeforge.shell.timed_out": False,
                }
            )
            add_span_event(
                "shell.command_finished",
                {"exit_code": exit_code, "output_lines": output_lines},
            )
            yield {
                "type": "shell_result",
                "payload": {
                    "command": sanitized,
                    "cwd": root.as_posix(),
                    "exit_code": exit_code,
                    "timed_out": False,
                    "output_lines": output_lines,
                },
            }
        finally:
            if process.returncode is None:
                process.kill()
                await process.wait()
