from __future__ import annotations

import asyncio
import json
import os
import shlex
import shutil
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

VALID_AGENT_ENGINES = frozenset({"codeforge", "hermes"})

_HERMES_EVENT_ALIASES = {
    "text": "token",
    "text_delta": "token",
    "assistant": "token",
    "message": "token",
    "tool": "tool_call",
    "tool_use": "tool_call",
    "tool_call": "tool_call",
    "tool_result": "tool_result",
    "tool_output": "tool_result",
    "run_started": "run_started",
    "started": "run_started",
    "complete": "complete",
    "done": "complete",
    "error": "raw",
}


def env_hermes_enabled() -> bool:
    return os.getenv("CODEFORGE_HERMES_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def hermes_simulate_enabled() -> bool:
    return os.getenv("CODEFORGE_HERMES_SIMULATE", "false").strip().lower() in {"1", "true", "yes", "on"}


def hermes_home() -> str | None:
    configured = os.getenv("HERMES_HOME", "").strip()
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.is_dir():
            return str(candidate.resolve())
    default = Path.home() / ".hermes"
    return str(default.resolve()) if default.is_dir() else None


def hermes_binary_path() -> str | None:
    configured = os.getenv("CODEFORGE_HERMES_BINARY", "").strip()
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.is_file():
            return str(candidate.resolve())
    resolved = shutil.which("hermes")
    return resolved


def hermes_runtime_available() -> bool:
    return bool(hermes_binary_path()) or hermes_simulate_enabled()


def resolve_agent_engine(preferences: dict[str, Any]) -> str:
    engine = (preferences.get("agent_engine") or "codeforge").strip().lower()
    if engine not in VALID_AGENT_ENGINES:
        return "codeforge"
    if engine == "hermes" and not env_hermes_enabled():
        return "codeforge"
    return engine


def should_run_hermes(user_id: str, preferences: dict[str, Any] | None = None) -> bool:
    from .skills_service import skills_service

    prefs = preferences or skills_service.get_preferences(user_id)
    return resolve_agent_engine(prefs) == "hermes" and hermes_runtime_available()


def build_hermes_argv(*, session_id: str, prompt: str) -> list[str]:
    binary = hermes_binary_path()
    if not binary:
        raise RuntimeError("Hermes binary is not available")

    args = [binary]
    extra = os.getenv("CODEFORGE_HERMES_EXTRA_ARGS", "").strip()
    if extra:
        args.extend(shlex.split(extra))
    profile = os.getenv("CODEFORGE_HERMES_PROFILE_PREFIX", "codeforge").strip() or "codeforge"
    args.extend(["-p", f"{profile}-{session_id}"])
    args.append(prompt)
    return args


def normalize_hermes_event(raw: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    event_type = str(raw.get("type") or raw.get("event") or "").strip().lower()
    if not event_type:
        return None
    mapped = _HERMES_EVENT_ALIASES.get(event_type, event_type)

    if mapped == "token":
        content = raw.get("content") or raw.get("text") or raw.get("delta") or raw.get("message")
        if not content:
            return None
        payload = {"content": str(content), "model": raw.get("model") or "hermes"}
        return mapped, payload

    if mapped == "tool_call":
        payload = {
            "tool": raw.get("tool") or raw.get("name") or "hermes_tool",
            "input": raw.get("input") or raw.get("arguments") or raw.get("args") or {},
        }
        return mapped, payload

    if mapped == "tool_result":
        payload = {
            "tool": raw.get("tool") or raw.get("name") or "hermes_tool",
            "output": raw.get("output") or raw.get("result") or raw.get("content") or "",
        }
        return mapped, payload

    if mapped in {"run_started", "complete", "raw"}:
        payload = {key: value for key, value in raw.items() if key not in {"type", "event"}}
        return mapped, payload

    payload = dict(raw)
    payload.pop("type", None)
    payload.pop("event", None)
    return "raw", payload


def _chunk_text(text: str, chunk_size: int = 24) -> list[str]:
    normalized = text.replace("\r\n", "\n")
    if not normalized:
        return []
    chunks: list[str] = []
    for line in normalized.split("\n"):
        if not line:
            chunks.append("\n")
            continue
        start = 0
        while start < len(line):
            chunks.append(line[start : start + chunk_size])
            start += chunk_size
        chunks.append("\n")
    if chunks and chunks[-1] == "\n":
        chunks.pop()
    return chunks


@dataclass
class HermesRunResult:
    assistant_message: str = ""
    events: list[tuple[str, dict[str, Any]]] = field(default_factory=list)


async def _stream_simulated(prompt: str, *, trace_id: str | None) -> AsyncIterator[tuple[str, dict[str, Any]]]:
    yield (
        "run_started",
        {
            "agent_engine": "hermes",
            "model": "hermes-simulate",
            "intent": "hermes_run",
            "simulate": True,
            "trace_id": trace_id,
        },
    )
    summary = f"Hermes simulate mode: received prompt ({len(prompt)} chars)."
    for chunk in _chunk_text(summary):
        payload = {"content": chunk, "model": "hermes-simulate", "trace_id": trace_id}
        yield "token", payload
        await asyncio.sleep(0)
    yield (
        "complete",
        {
            "agent_engine": "hermes",
            "model": "hermes-simulate",
            "intent": "hermes_run",
            "simulate": True,
            "trace_id": trace_id,
        },
    )


async def _stream_subprocess(
    *,
    session_id: str,
    prompt: str,
    project_path: str | None,
    trace_id: str | None,
) -> AsyncIterator[tuple[str, dict[str, Any]]]:
    argv = build_hermes_argv(session_id=session_id, prompt=prompt)
    env = os.environ.copy()
    if project_path:
        env["CODEFORGE_PROJECT_PATH"] = project_path
    home = hermes_home()
    if home:
        env.setdefault("HERMES_HOME", home)

    process = await asyncio.create_subprocess_exec(
        *argv,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )

    yield (
        "run_started",
        {
            "agent_engine": "hermes",
            "model": "hermes",
            "intent": "hermes_run",
            "trace_id": trace_id,
            "command": argv[0],
        },
    )

    assert process.stdout is not None
    plain_text: list[str] = []
    async for raw_line in process.stdout:
        line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            plain_text.append(line)
            for chunk in _chunk_text(line + "\n"):
                yield "token", {"content": chunk, "model": "hermes", "trace_id": trace_id}
            continue

        if not isinstance(payload, dict):
            plain_text.append(line)
            continue
        normalized = normalize_hermes_event(payload)
        if normalized is None:
            continue
        event_type, event_payload = normalized
        event_payload.setdefault("trace_id", trace_id)
        if event_type == "token":
            content = event_payload.get("content", "")
            if content:
                plain_text.append(str(content))
        yield event_type, event_payload

    stderr_data = b""
    if process.stderr is not None:
        stderr_data = await process.stderr.read()
    await process.wait()

    if process.returncode != 0:
        detail = stderr_data.decode("utf-8", errors="replace").strip()
        yield (
            "raw",
            {
                "message": "Hermes process exited with a non-zero status",
                "exit_code": process.returncode,
                "stderr": detail[-2000:] if detail else None,
                "trace_id": trace_id,
            },
        )

    assistant_message = "".join(plain_text)
    yield (
        "complete",
        {
            "agent_engine": "hermes",
            "model": "hermes",
            "intent": "hermes_run",
            "trace_id": trace_id,
            "assistant_chars": len(assistant_message),
        },
    )


async def stream_hermes_run(
    *,
    prompt: str,
    session_id: str,
    project_path: str | None,
    trace_id: str | None = None,
) -> AsyncIterator[tuple[str, dict[str, Any], str | None]]:
    """Yield (event_type, payload, assistant_delta) tuples for SSE bridging."""
    assistant_parts: list[str] = []

    if hermes_simulate_enabled():
        stream = _stream_simulated(prompt, trace_id=trace_id)
    elif hermes_binary_path():
        stream = _stream_subprocess(
            session_id=session_id,
            prompt=prompt,
            project_path=project_path,
            trace_id=trace_id,
        )
    else:
        yield (
            "raw",
            {
                "message": "Hermes engine selected but binary is not installed",
                "trace_id": trace_id,
                "fallback": "codeforge",
            },
            None,
        )
        return

    async for event_type, payload in stream:
        delta: str | None = None
        if event_type == "token":
            delta = str(payload.get("content") or "")
            if delta:
                assistant_parts.append(delta)
        yield event_type, payload, delta

    full_message = "".join(assistant_parts).strip()
    if full_message:
        yield "hermes_assistant_message", {"content": full_message}, full_message


def collect_assistant_message(events: list[tuple[str, dict[str, Any], str | None]]) -> str:
    parts: list[str] = []
    for event_type, _payload, delta in events:
        if event_type == "token" and delta:
            parts.append(delta)
        if event_type == "hermes_assistant_message" and delta:
            return delta
    return "".join(parts).strip()
