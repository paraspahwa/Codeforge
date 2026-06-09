from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.context_mcp import ContextMcpError
from app.mcp_transport import invoke_remote_tool


def test_invoke_remote_tool_ping() -> None:
    result = invoke_remote_tool(
        endpoint="http://mcp.example.com",
        transport="http",
        tool_name="ping",
        arguments={"hello": "world"},
    )
    assert result["ok"] is True
    assert result["message"] == "pong"


def test_invoke_remote_tool_rejects_stdio() -> None:
    with pytest.raises(ContextMcpError, match="stdio MCP transport"):
        invoke_remote_tool(
            endpoint="ignored",
            transport="stdio",
            tool_name="search",
            arguments={},
        )


def test_invoke_http_tool_parses_jsonrpc_result() -> None:
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "jsonrpc": "2.0",
        "id": "cf_abc",
        "result": {"content": [{"type": "text", "text": "done"}]},
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_response

    with patch("app.mcp_transport.httpx.Client", return_value=mock_client):
        result = invoke_remote_tool(
            endpoint="http://mcp.example.com",
            transport="http",
            tool_name="search",
            arguments={"query": "billing"},
        )

    assert result["ok"] is True
    assert result["tool"] == "search"
    assert "content" in result


def test_invoke_http_tool_surfaces_remote_error() -> None:
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "jsonrpc": "2.0",
        "id": "cf_abc",
        "error": {"message": "tool unavailable"},
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_response

    with patch("app.mcp_transport.httpx.Client", return_value=mock_client):
        with pytest.raises(ContextMcpError, match="tool unavailable"):
            invoke_remote_tool(
                endpoint="http://mcp.example.com",
                transport="http",
                tool_name="search",
                arguments={},
            )


def test_invoke_http_tool_retries_alternate_paths() -> None:
    not_found = MagicMock(status_code=404, text="missing")
    ok_response = MagicMock()
    ok_response.status_code = 200
    ok_response.json.return_value = {"result": {"items": [1]}}

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.side_effect = [not_found, ok_response]

    with patch("app.mcp_transport.httpx.Client", return_value=mock_client):
        result = invoke_remote_tool(
            endpoint="http://mcp.example.com",
            transport="http",
            tool_name="list",
            arguments={},
        )

    assert result["items"] == [1]
    assert mock_client.post.call_count == 2


def test_invoke_http_tool_reports_transport_failure() -> None:
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.side_effect = httpx.ConnectError("connection refused")

    with patch("app.mcp_transport.httpx.Client", return_value=mock_client):
        with pytest.raises(ContextMcpError, match="connection refused"):
            invoke_remote_tool(
                endpoint="http://mcp.example.com",
                transport="http",
                tool_name="search",
                arguments={},
            )
