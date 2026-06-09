from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import httpx

from .context_mcp import ContextMcpError


def invoke_remote_tool(
    *,
    endpoint: str,
    transport: str,
    tool_name: str,
    arguments: dict[str, Any],
    timeout_seconds: float = 20.0,
) -> dict[str, Any]:
    if transport == "stdio":
        raise ContextMcpError("stdio MCP transport must run locally; register an http connector for remote tools")
    if transport == "websocket":
        raise ContextMcpError("websocket MCP transport is not enabled yet; use http transport")

    if tool_name == "ping":
        return {"ok": True, "tool": "ping", "message": "pong", "echo": arguments}

    if transport != "http":
        raise ContextMcpError(f"Unsupported MCP transport: {transport}")

    return _invoke_http_tool(
        endpoint=endpoint,
        tool_name=tool_name,
        arguments=arguments,
        timeout_seconds=timeout_seconds,
    )


def _invoke_http_tool(
    *,
    endpoint: str,
    tool_name: str,
    arguments: dict[str, Any],
    timeout_seconds: float,
) -> dict[str, Any]:
    base = endpoint.rstrip("/")
    candidates = [
        f"{base}/tools/call",
        f"{base}/mcp/tools/call",
        base,
    ]
    payload = {
        "jsonrpc": "2.0",
        "id": f"cf_{uuid4().hex[:8]}",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        },
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    last_error = "no MCP endpoint accepted the request"
    with httpx.Client(timeout=timeout_seconds) as client:
        for url in candidates:
            try:
                response = client.post(url, json=payload, headers=headers)
            except httpx.HTTPError as exc:
                last_error = str(exc)
                continue

            if response.status_code >= 500:
                last_error = f"{url} returned {response.status_code}"
                continue

            if response.status_code >= 400:
                last_error = f"{url} returned {response.status_code}: {response.text[:240]}"
                continue

            try:
                body = response.json()
            except json.JSONDecodeError:
                return {
                    "ok": True,
                    "tool": tool_name,
                    "transport": "http",
                    "endpoint": url,
                    "raw": response.text[:4000],
                }

            if isinstance(body, dict) and body.get("error"):
                error = body["error"]
                message = error.get("message") if isinstance(error, dict) else str(error)
                raise ContextMcpError(message or "MCP tool call failed")

            if isinstance(body, dict) and "result" in body:
                result = body["result"]
                if isinstance(result, dict):
                    return {"ok": True, "tool": tool_name, "transport": "http", "endpoint": url, **result}
                return {"ok": True, "tool": tool_name, "transport": "http", "endpoint": url, "result": result}

            if isinstance(body, dict):
                return {"ok": True, "tool": tool_name, "transport": "http", "endpoint": url, **body}

            return {"ok": True, "tool": tool_name, "transport": "http", "endpoint": url, "result": body}

    raise ContextMcpError(last_error)
