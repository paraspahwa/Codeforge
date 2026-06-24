from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agent_reach_service import (
    AgentReachError,
    _parse_github_repo,
    channel_web_enabled,
    github_repo,
    probe_channel_status,
    rss_read,
)


def test_parse_github_repo_from_slug() -> None:
    owner, name = _parse_github_repo("Panniantong/Agent-Reach")
    assert owner == "Panniantong"
    assert name == "Agent-Reach"


def test_parse_github_repo_from_url() -> None:
    owner, name = _parse_github_repo("https://github.com/Panniantong/Agent-Reach.git")
    assert owner == "Panniantong"
    assert name == "Agent-Reach"


@pytest.mark.asyncio
async def test_fetch_web_success() -> None:
    from app.agent_reach_service import fetch_web

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = "# Hello\n\nArticle body."

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    with patch("app.agent_reach_service.httpx.AsyncClient", return_value=mock_client):
        with patch("app.agent_reach_service.channel_web_enabled", return_value=True):
            payload = await fetch_web("https://example.com/post")

    assert payload["ok"] is True
    assert payload["source"] == "jina_reader"
    assert "Article body" in payload["content"]


@pytest.mark.asyncio
async def test_fetch_web_disabled() -> None:
    from app.agent_reach_service import fetch_web

    with patch("app.agent_reach_service.channel_web_enabled", return_value=False):
        with pytest.raises(AgentReachError, match="disabled"):
            await fetch_web("https://example.com")


def test_rss_read_parses_feed() -> None:
    feed = MagicMock()
    feed.title = "Test Feed"
    entry = MagicMock()
    entry.title = "Item 1"
    entry.link = "https://example.com/1"
    entry.published = "Mon, 01 Jan 2024 00:00:00 GMT"
    entry.summary = "Summary"
    parsed = MagicMock(feed=feed, entries=[entry], bozo=False)

    with patch("app.agent_reach_service.channel_rss_enabled", return_value=True):
        with patch("feedparser.parse", return_value=parsed):
            payload = rss_read("https://example.com/feed.xml", limit=5)

    assert payload["ok"] is True
    assert payload["entry_count"] == 1
    assert payload["entries"][0]["title"] == "Item 1"


@pytest.mark.asyncio
async def test_github_repo_success() -> None:
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "full_name": "Panniantong/Agent-Reach",
        "description": "Internet research tools",
        "stargazers_count": 100,
        "forks_count": 10,
        "language": "Python",
        "default_branch": "main",
        "html_url": "https://github.com/Panniantong/Agent-Reach",
        "topics": ["ai-agent"],
        "open_issues_count": 2,
        "updated_at": "2026-01-01T00:00:00Z",
    }

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    with patch("app.agent_reach_service.httpx.AsyncClient", return_value=mock_client):
        with patch("app.agent_reach_service.channel_github_enabled", return_value=True):
            payload = await github_repo("Panniantong/Agent-Reach")

    assert payload["ok"] is True
    assert payload["stars"] == 100
    assert payload["language"] == "Python"


@pytest.mark.asyncio
async def test_probe_channel_status_structure() -> None:
    with patch("app.agent_reach_service.channel_web_enabled", return_value=True):
        with patch("app.agent_reach_service.channel_youtube_enabled", return_value=False):
            with patch("app.agent_reach_service.channel_rss_enabled", return_value=True):
                with patch("app.agent_reach_service.channel_github_enabled", return_value=True):
                    mock_response = MagicMock(status_code=200)
                    mock_client = AsyncMock()
                    mock_client.head.return_value = mock_response
                    mock_client.get.return_value = mock_response
                    mock_client.__aenter__.return_value = mock_client
                    mock_client.__aexit__.return_value = None
                    with patch("app.agent_reach_service.httpx.AsyncClient", return_value=mock_client):
                        payload = await probe_channel_status()

    assert "channels" in payload
    assert "web" in payload["channels"]
    assert payload["channels"]["youtube"]["disabled"] is True


def test_mcp_native_agent_reach_fetch_web() -> None:
    from app.mcp_native import invoke_native_tool

    with patch(
        "app.agent_reach_service.fetch_web",
        new_callable=AsyncMock,
        return_value={"ok": True, "content": "hi"},
    ):
        result = invoke_native_tool(
            server_id="agent_reach",
            tool_name="fetch_web",
            arguments={"url": "https://example.com"},
        )
    assert result["ok"] is True
    assert result["content"] == "hi"


def test_platform_agent_reach_status_route(client) -> None:
    response = client.get("/api/v1/platform/agent-reach/status")
    assert response.status_code == 200
    body = response.json()
    assert "channels" in body
    assert "web" in body["channels"]
