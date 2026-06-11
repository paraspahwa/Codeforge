# Phase 10 — Curated Anthropic skills pack

## Goal

Bundle a small set of high-value instruction skills from [anthropics/skills](https://github.com/anthropics/skills) for CodeForge agents without vendoring heavy document skills (`docx`, `pdf`, `pptx`, `xlsx`) or companion scripts.

## Shipped skills

| Skill | Purpose |
|-------|---------|
| `frontend-design` | Distinctive UI/aesthetic direction |
| `webapp-testing` | Playwright + Cowork browser testing |
| `mcp-builder` | MCP server design and implementation |
| `skill-creator` | Author and tune `.codeforge/skills` |
| `doc-coauthoring` | Structured docs/proposals workflow |

Existing bundled skills unchanged: `caveman`, `pr-conventions`.

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/skills` | List bundled + project skills |
| `GET /api/v1/skills/{skill_name}` | Full skill body, license, and source metadata |
| `GET /api/v1/agent/preferences` | Current `caveman_mode`, `enabled_skills`, `rtk_enabled` |
| `PUT /api/v1/agent/preferences` | Update prefs — unknown skill names return 400 |

## How it works

- Skills live under `.codeforge/skills/<name>/SKILL.md`.
- Users enable skills in Settings or via `enabled_skills` in agent preferences.
- `skills_service.compose_agent_instructions` injects enabled skill bodies (truncated to ~2500 chars each).
- Project `.codeforge/skills/` overrides bundled names with the same skill name.

## Attribution

See `.codeforge/skills/THIRD_PARTY_NOTICES.md`.

## Out of scope

- Vendoring Anthropic `scripts/`, `references/`, or source-available Office skills
- Auto-running bundled Python helpers from upstream `webapp-testing`

## Verification

```powershell
cd services\api
$env:CODEFORGE_ENV = "development"
.\.venv\Scripts\python -m pytest tests/test_skills.py -v
```

Enable skills in the web UI (Settings → Skills) or:

```http
PUT /api/v1/agent/preferences
{ "enabled_skills": ["frontend-design", "webapp-testing"] }
```
