"""Native MCP tool handlers — bridge catalog servers to built-in CodeForge capabilities."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from .context_mcp import ContextMcpError
from .file_ops import (
    _fallback_project_root,
    list_workspace_files,
    read_file_content,
    apply_proposed_content,
)
from .symbol_search import search_symbols


def invoke_native_tool(*, server_id: str, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if server_id == "everything":
        return _invoke_everything(tool_name, arguments)
    if server_id == "time":
        return _invoke_time(tool_name, arguments)
    if server_id == "filesystem":
        return _invoke_filesystem(tool_name, arguments)
    if server_id == "git":
        return _invoke_git(tool_name, arguments)
    if server_id == "sequential_thinking":
        return _invoke_sequential_thinking(tool_name, arguments)
    if server_id == "web_search":
        return _invoke_web_search(tool_name, arguments)
    if server_id == "open_library":
        return _invoke_open_library(tool_name, arguments)
    raise ContextMcpError(f"Native MCP server '{server_id}' is not implemented")


def _filesystem_project_path(arguments: dict[str, Any]) -> str:
    project_path = str(arguments.get("project_path") or arguments.get("root") or "").strip()
    if project_path:
        return project_path
    fallback = _fallback_project_root()
    if fallback is not None:
        return str(fallback)
    raise ContextMcpError("project_path is required for filesystem MCP tools")


def _invoke_filesystem(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    project_path = _filesystem_project_path(arguments)

    if tool_name == "read_file":
        path = str(arguments.get("path", "")).strip()
        if not path:
            raise ContextMcpError("path is required")
        from .file_ops import resolve_repo_path

        if resolve_repo_path(project_path, path) is None:
            raise ContextMcpError(f"File not found: {path}")
        content = read_file_content(project_path, path)
        return {"ok": True, "path": path, "content": content}

    if tool_name == "write_file":
        path = str(arguments.get("path", "")).strip()
        content = str(arguments.get("content", arguments.get("text", "")))
        if not path:
            raise ContextMcpError("path is required")
        applied = apply_proposed_content(project_path, path, content)
        if not applied:
            raise ContextMcpError(f"Unable to write file: {path}")
        return {"ok": True, "path": path, "written": True}

    if tool_name == "list_directory":
        entries = list_workspace_files(project_path, max_files=int(arguments.get("limit", 300)))
        directory = str(arguments.get("path", "")).strip()
        if directory:
            prefix = directory.rstrip("/") + "/"
            entries = [item for item in entries if item.startswith(prefix) or item == directory]
        return {"ok": True, "path": directory or ".", "entries": entries}

    if tool_name == "search_files":
        query = str(arguments.get("query", arguments.get("pattern", ""))).strip()
        if not query:
            raise ContextMcpError("query is required")
        payload = search_symbols(project_path, query, limit=int(arguments.get("limit", 40)))
        return {"ok": True, "query": query, **payload}

    raise ContextMcpError(f"Unknown filesystem tool: {tool_name}")


def _invoke_everything(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if tool_name == "ping":
        return {"ok": True, "message": "pong", "echo": arguments}
    if tool_name == "echo":
        return {"ok": True, "echo": arguments.get("message", "")}
    if tool_name == "add":
        a = float(arguments.get("a", 0))
        b = float(arguments.get("b", 0))
        return {"ok": True, "sum": a + b}
    return {"ok": True, "tool": tool_name, "note": "Everything reference tool", "arguments": arguments}


def _invoke_time(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if tool_name == "get_current_time":
        tz_name = str(arguments.get("timezone", "UTC"))
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = timezone.utc
            tz_name = "UTC"
        now = datetime.now(tz)
        return {
            "ok": True,
            "timezone": tz_name,
            "iso": now.isoformat(),
            "epoch": int(now.timestamp()),
        }
    if tool_name == "convert_time":
        source = str(arguments.get("source_timezone", "UTC"))
        target = str(arguments.get("target_timezone", "UTC"))
        time_str = str(arguments.get("time", ""))
        return {
            "ok": True,
            "source_timezone": source,
            "target_timezone": target,
            "input": time_str,
            "note": "Use get_current_time for live clock; conversion requires local MCP server for full support.",
        }
    raise ContextMcpError(f"Unknown time tool: {tool_name}")


def _invoke_git(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    mapping = {
        "git_status": "git_status",
        "git_diff": "git_diff",
        "git_log": "run_shell",
        "git_commit": "run_shell",
    }
    native = mapping.get(tool_name)
    if not native:
        raise ContextMcpError(f"Unknown git tool: {tool_name}")
    return {
        "ok": True,
        "delegated": True,
        "codeforge_tool": native,
        "arguments": arguments,
        "message": f"Use CodeForge built-in '{native}' tool.",
    }


def _invoke_sequential_thinking(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    thought = str(arguments.get("thought", "")).strip()
    step = int(arguments.get("step", 1))
    total = int(arguments.get("total_steps", step))
    return {
        "ok": True,
        "step": step,
        "total_steps": total,
        "thought": thought,
        "message": "Sequential thinking step recorded.",
    }


async def _invoke_web_search_async(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    from .web_search_service import search_web

    if tool_name == "web_search":
        query = str(arguments.get("query", "")).strip()
        if not query:
            raise ContextMcpError("query is required")
        limit = int(arguments.get("limit", 5))
        payload = await search_web(query, limit=limit)
        return {"ok": True, **payload}
    if tool_name == "fetch_url":
        url = str(arguments.get("url", "")).strip()
        if not url:
            raise ContextMcpError("url is required")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url)
            text = response.text[:8000]
        return {"ok": True, "url": url, "status": response.status_code, "content": text}
    raise ContextMcpError(f"Unknown web search tool: {tool_name}")


def _invoke_web_search(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    import asyncio

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_invoke_web_search_async(tool_name, arguments))
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(asyncio.run, _invoke_web_search_async(tool_name, arguments))
        return future.result(timeout=30)


def _invoke_open_library(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if tool_name == "search_books":
        query = str(arguments.get("query", "")).strip()
        if not query:
            raise ContextMcpError("query is required")
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                "https://openlibrary.org/search.json",
                params={"q": query, "limit": int(arguments.get("limit", 5))},
            )
            response.raise_for_status()
            body = response.json()
        docs = body.get("docs", [])[:5]
        return {
            "ok": True,
            "query": query,
            "result_count": len(docs),
            "books": [
                {
                    "title": doc.get("title"),
                    "author": doc.get("author_name", []),
                    "year": doc.get("first_publish_year"),
                    "key": doc.get("key"),
                }
                for doc in docs
            ],
        }
    if tool_name == "get_book_details":
        key = str(arguments.get("key", "")).strip().lstrip("/")
        if not key:
            raise ContextMcpError("key is required")
        if not key.startswith("works/") and not key.startswith("books/"):
            key = f"works/{key}"
        with httpx.Client(timeout=15.0) as client:
            response = client.get(f"https://openlibrary.org/{key}.json")
            response.raise_for_status()
            body = response.json()
        return {"ok": True, "key": key, "details": body}
    raise ContextMcpError(f"Unknown open library tool: {tool_name}")
