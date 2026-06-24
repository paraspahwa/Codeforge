# Agent Reach in CodeForge

CodeForge integrates [Agent Reach](https://github.com/Panniantong/Agent-Reach) as a **skill + server-native MCP tools** — not as a full copy of the upstream installer inside Docker.

## What you get

| Capability | Where it runs |
|------------|----------------|
| Read web pages (Jina Reader) | API / worker (`fetch_web`) |
| YouTube subtitles | API / worker (`youtube_transcript`) |
| RSS / Atom feeds | API / worker (`rss_read`) |
| Public GitHub repo metadata | API / worker (`github_repo`) |
| Twitter, Reddit, XHS, Bilibili login, Exa | **Local machine** via Agent Reach CLI + skill |

## Quick start (web app)

1. **Settings → Skills** — enable `agent-reach` (or install **Internet research** extension).
2. **MCP** — enable **Agent Reach (server)** connector.
3. Ask in chat, for example:
   - “Summarize https://www.youtube.com/watch?v=…”
   - “Read this article: https://…”
   - “What’s in this RSS feed: https://…”
   - “Describe the GitHub repo Panniantong/Agent-Reach”

## Quick start (local Cursor / dev laptop)

For social platforms and full upstream routing:

```bash
pipx install https://github.com/Panniantong/Agent-Reach/archive/main.zip
agent-reach install --env=auto
agent-reach doctor
```

See [`.codeforge/skills/agent-reach/SKILL.md`](../.codeforge/skills/agent-reach/SKILL.md) for command reference and security notes.

## Environment variables (server)

All default to `true` when unset.

| Variable | Channel |
|----------|---------|
| `CODEFORGE_AGENT_REACH_WEB` | Jina `fetch_web` |
| `CODEFORGE_AGENT_REACH_YOUTUBE` | yt-dlp subtitles |
| `CODEFORGE_AGENT_REACH_RSS` | feedparser |
| `CODEFORGE_AGENT_REACH_GITHUB` | GitHub REST API |

## Health check

```bash
curl http://localhost:8000/api/v1/platform/agent-reach/status
```

Returns per-channel status (similar to `agent-reach doctor` for server tools only).

## Architecture

- **Skill** — prompt playbook at `.codeforge/skills/agent-reach/SKILL.md`
- **MCP** — native connector `agent_reach` in [`mcp_catalog.py`](../services/api/app/mcp_catalog.py)
- **Service** — [`agent_reach_service.py`](../services/api/app/agent_reach_service.py)
- **Agent routing** — URL heuristics in `infer_tool_plan` → `mcp_call` with `catalog_id: agent_reach`
- **Cowork** — planner prefers connector tasks over generic scrape for YouTube/RSS/GitHub URLs

## Security

- Do **not** store Twitter/XHS cookies in CodeForge database or env files.
- Use secondary accounts for cookie-based platforms.
- Do not run `agent-reach install --channels=all` inside production API containers.

## Upstream

- Repository: https://github.com/Panniantong/Agent-Reach
- License: MIT (see `.codeforge/skills/THIRD_PARTY_NOTICES.md`)
