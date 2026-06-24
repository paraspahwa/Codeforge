---
name: agent-reach
description: >
  Internet research across web, YouTube, GitHub, RSS, Bilibili, Twitter, Reddit, and XiaoHongShu.
  Use when the user asks to search or read social platforms, summarize videos, digest RSS feeds,
  or do market/competitor research.
keywords: twitter, reddit, youtube, bilibili, xiaohongshu, rss, exa, research, 调研, summarize video
slash: /research
source: https://github.com/Panniantong/Agent-Reach
license: MIT
---

> CodeForge: prefer **server** tools via `mcp_call` when the `agent_reach` connector is enabled.
> Use **local** Agent Reach CLI only on the developer machine (Cursor/native shell), not in Docker sessions.

# Agent Reach — Internet Research

Adapted from [Agent-Reach](https://github.com/Panniantong/Agent-Reach) (MIT). Agent Reach is a capability layer: it selects, installs, and health-checks upstream tools — it is not a wrapper API.

## Server vs local

| Channel | Where | How |
|---------|-------|-----|
| Web pages | Server | `mcp_call` → `agent_reach` / `fetch_web` |
| YouTube transcript | Server | `mcp_call` → `agent_reach` / `youtube_transcript` |
| RSS / Atom | Server | `mcp_call` → `agent_reach` / `rss_read` |
| Public GitHub repo | Server | `mcp_call` → `agent_reach` / `github_repo` |
| Twitter, Reddit, XHS, LinkedIn, Bilibili login | **Local only** | Install Agent Reach CLI + OpenCLI / cookies |
| Semantic Exa search | Local (mcporter) | `agent-reach install` on dev machine |

Enable the **Agent Reach (server)** connector in Settings → MCP before using server tools.

## CodeForge `mcp_call` examples

```json
{"connector_id": "<from enabled connectors>", "catalog_id": "agent_reach", "tool_name": "fetch_web", "arguments": {"url": "https://example.com/article"}}
```

```json
{"catalog_id": "agent_reach", "tool_name": "youtube_transcript", "arguments": {"url": "https://www.youtube.com/watch?v=VIDEO_ID"}}
```

```json
{"catalog_id": "agent_reach", "tool_name": "rss_read", "arguments": {"url": "https://hnrss.org/frontpage", "limit": 10}}
```

```json
{"catalog_id": "agent_reach", "tool_name": "github_repo", "arguments": {"repo": "owner/name"}}
```

Use `catalog_id: agent_reach` when the connector UUID is unknown — CodeForge resolves the installed connector.

## Local install (Cursor / dev laptop)

```bash
pipx install https://github.com/Panniantong/Agent-Reach/archive/main.zip
agent-reach install --env=auto
agent-reach doctor
```

Safe mode (no auto system changes): `agent-reach install --env=auto --safe`

Update: `pipx upgrade agent-reach` then `agent-reach install --env=auto`

## Upstream command cheat sheet

| Platform | Tool | Example |
|----------|------|---------|
| Web | Jina Reader | `curl -s "https://r.jina.ai/https://example.com"` |
| YouTube | yt-dlp | `yt-dlp --write-sub --skip-download --sub-lang en URL` |
| GitHub | gh | `gh repo view owner/repo` |
| RSS | feedparser | Python one-liner or `rss_read` MCP tool |
| Twitter | twitter-cli | `twitter search "query" -n 10` (needs cookies) |
| Reddit | OpenCLI / rdt-cli | `opencli reddit search "query"` (login required) |
| Bilibili | bili-cli | `bili search "query" --type video` |
| 小红书 | OpenCLI | `opencli xiaohongshu search "query"` (desktop + extension) |

Run `agent-reach doctor` to see which backends are active.

## Security

- Store cookies/tokens only in `~/.agent-reach/` on the local machine (mode 600). **Never** commit cookies or paste them into the repo.
- Use **secondary accounts** for Twitter/XHS cookie auth (ban risk).
- Do not run `agent-reach install` inside CodeForge API/worker containers — use server MCP tools instead.
- Proxy for restricted networks: `agent-reach configure proxy http://user:pass@host:port`

## When to escalate

- **Cowork browser task** — multi-step login, form submit, or authenticated web UI
- **Built-in `web_search`** — quick Stack Overflow / Wikipedia / DuckDuckGo lookup (no URL needed)
- **ScrapeGraphAI `scrape` Cowork task** — complex JS-heavy pages when Jina `fetch_web` is insufficient
