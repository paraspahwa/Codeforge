# Agent Reach in CodeForge

CodeForge integrates [Agent Reach](https://github.com/Panniantong/Agent-Reach) as a **skill + server-native MCP tools** — not as a full copy of the upstream installer inside Docker.

## What you get

| Capability | Where it runs |
|------------|----------------|
| Read web pages (Jina Reader) | API (`fetch_web`) |
| YouTube subtitles | API (`youtube_transcript`) |
| RSS / Atom feeds | API (`rss_read`) |
| Public GitHub repo metadata | API (`github_repo`) |
| Semantic web research | API (`exa_search`) — needs `EXA_API_KEY` |
| Bilibili video search | API (`bilibili_search`) |
| JS-heavy scrape / search | API (`firecrawl_scrape`, `firecrawl_search`) — needs `FIRECRAWL_API_KEY` |
| Twitter, Reddit, XHS (login) | **Local machine** via Agent Reach CLI + skill |

## Quick start (web app)

1. **Settings → Skills** — enable `agent-reach` (or install **Internet research** extension).
2. **MCP** — enable **Agent Reach (server)** connector.
3. **Settings → Deploy** — review Agent Reach doctor status.
4. Add API keys to `.env.local` (optional but recommended):
   - `EXA_API_KEY` from [exa.ai](https://exa.ai)
   - `FIRECRAWL_API_KEY` from [firecrawl.dev](https://firecrawl.dev)
5. Ask in chat, for example:
   - “Research competing LLM agent frameworks”
   - “Search Bilibili for Rust tutorials”
   - “Summarize https://www.youtube.com/watch?v=…”
   - “Scrape this JS-heavy docs page: https://…”

## Quick start (local Cursor / dev laptop)

For social platforms and full upstream routing:

```bash
pipx install https://github.com/Panniantong/Agent-Reach/archive/main.zip
agent-reach install --env=auto
agent-reach doctor
```

See [`.codeforge/skills/agent-reach/SKILL.md`](../.codeforge/skills/agent-reach/SKILL.md) for command reference and security notes.

## Environment variables (server)

Channel toggles default to `true` when unset. Exa and Firecrawl also require API keys.

| Variable | Channel |
|----------|---------|
| `CODEFORGE_AGENT_REACH_WEB` | Jina `fetch_web` |
| `CODEFORGE_AGENT_REACH_YOUTUBE` | yt-dlp subtitles |
| `CODEFORGE_AGENT_REACH_RSS` | feedparser |
| `CODEFORGE_AGENT_REACH_GITHUB` | GitHub REST API |
| `CODEFORGE_AGENT_REACH_EXA` + `EXA_API_KEY` | Exa semantic search |
| `CODEFORGE_AGENT_REACH_BILIBILI` | Bilibili search API / bili-cli |
| `CODEFORGE_AGENT_REACH_FIRECRAWL` + `FIRECRAWL_API_KEY` | Firecrawl scrape/search |

## Health check

```bash
curl http://localhost:8000/api/v1/platform/agent-reach/status
```

Also visible in **Settings → Deploy → Agent Reach (server channels)**.

## Architecture

- **Skill** — `.codeforge/skills/agent-reach/SKILL.md`
- **MCP** — native connector `agent_reach` in [`mcp_catalog.py`](../services/api/app/mcp_catalog.py)
- **Service** — [`agent_reach_service.py`](../services/api/app/agent_reach_service.py)
- **Agent routing** — URL + intent heuristics in `infer_tool_plan`
- **Cowork** — connector tasks for YouTube, RSS, GitHub, Exa, Bilibili

## Security

- Do **not** store Twitter/XHS cookies in CodeForge database or env files.
- Use secondary accounts for cookie-based platforms.
- Do not run `agent-reach install --channels=all` inside production API containers.

## Upstream

- Repository: https://github.com/Panniantong/Agent-Reach
- License: MIT (see `.codeforge/skills/THIRD_PARTY_NOTICES.md`)
