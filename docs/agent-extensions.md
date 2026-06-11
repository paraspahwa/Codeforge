# Agent Extensions (Phases 7–10)

Developer guide for taste, skills, RTK shell compression, agent memory, ScrapeGraphAI extraction, and the curated Anthropic skills pack.

For operator smoke tests and env var tables, see [DEPLOYMENT_RUNBOOK.md](../DEPLOYMENT_RUNBOOK.md) sections 14–17. For implementation tickets, see [docs/tickets/](tickets/).

---

## Overview

| Subsystem | Purpose | Key paths |
|-----------|---------|-----------|
| Taste | Learn coding preferences from proposal feedback | `services/api/app/taste_service.py`, `taste_store.py` |
| Skills | Inject instruction playbooks into agent prompts | `services/api/app/skills_service.py`, `.codeforge/skills/` |
| RTK | Compress shell command output before it reaches context | `services/api/app/shell_ops.py`, `rtk_service.py` |
| Memory | Cross-session recall (native + optional Supermemory) | `services/api/app/memory_service.py`, `supermemory_connector.py` |
| Scrape | Cowork natural-language extraction from URLs/files | `services/api/app/scrape_service.py`, `cowork.py` |

All subsystems compose into the agent stream via `stream_session` and synthesis system prompts. They are optional — the API runs without RTK, Supermemory, or ScrapeGraphAI when env vars are unset.

---

## Phase 7 — Taste (coding preferences)

### How it works

1. User approves, rejects, or edits a proposal (`/approve`, `/reject`, or web diff review).
2. Optional `note` and `edited_content` fields capture preference signals.
3. `taste_service` distills heuristics (e.g. naming style, test patterns) into weighted rules.
4. `compose_taste_context` injects active rules + team style guides into the agent prompt.

### API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/taste/rules` | GET | Active rules + rendered `taste_md` |
| `/api/v1/taste/stats` | GET | Approval/rejection metrics per session |
| `/api/v1/taste/export` | GET | Export taste pack for team sync |
| `/api/v1/taste/import` | POST | Import taste pack |

Proposal decisions accept optional `note` (free-text preference) and `edited_content` (user-edited diff on approve).

### Clients

- **Terminal:** `/taste stats`, `/taste rules`, `/taste export [path]`, `/taste import <path>`
- **Web:** Settings → Taste panel (rules, stats, import/export)

### Example

```bash
TOKEN=$(curl -fsS -X POST http://127.0.0.1:8000/api/v1/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"dev-user"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -fsS -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/api/v1/taste/stats | python3 -m json.tool
```

---

## Phase 7 + 10 — Agent skills

### Layout

Skills are markdown playbooks under `.codeforge/skills/<name>/SKILL.md`. Project skills override bundled names.

```
.codeforge/skills/
  caveman/SKILL.md           # bundled token-saver (MIT)
  pr-conventions/SKILL.md    # CodeForge-native
  frontend-design/SKILL.md   # Anthropic (Apache-2.0)
  webapp-testing/SKILL.md
  mcp-builder/SKILL.md
  skill-creator/SKILL.md
  doc-coauthoring/SKILL.md
```

See [.codeforge/skills/README.md](../.codeforge/skills/README.md) and [THIRD_PARTY_NOTICES.md](../.codeforge/skills/THIRD_PARTY_NOTICES.md).

### API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/skills` | GET | List available skills (`?project_path=` optional) |
| `/api/v1/skills/{name}` | GET | Skill detail including body |
| `/api/v1/agent/preferences` | GET/PUT | `caveman_mode`, `enabled_skills`, `rtk_enabled` |

Caveman levels: `off`, `lite`, `full`, `ultra`. Enabled skills are injected (truncated to ~2500 chars each) via `skills_service.compose_agent_instructions`.

### Clients

- **Terminal:** `/caveman off|lite|full|ultra|status|skills`
- **Web:** Settings → Token Saver (caveman mode + skill group toggles)

### Example

```bash
curl -fsS -X PUT http://127.0.0.1:8000/api/v1/agent/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"enabled_skills":["frontend-design","mcp-builder"],"caveman_mode":"lite"}'
```

---

## Phase 8 — RTK shell compression

### How it works

When enabled, `shell_ops.py` rewrites supported read-only commands through the `rtk` binary before output enters agent context. Supported commands include `git` (read-only), `pytest`, `npm test`, `cargo test`, `rg`, and `python -m pytest`.

RTK is effective when **either** `CODEFORGE_RTK_ENABLED=true` **or** the user preference `rtk_enabled` is set, and the binary is available on `PATH`.

### Configuration

```env
CODEFORGE_RTK_ENABLED=false
CODEFORGE_RTK_DEBUG=false   # attach raw tail on non-zero exit
CODEFORGE_RTK_BINARY=       # optional explicit path
```

API and worker Docker images install the Linux `rtk` binary automatically. On Windows hosts running the API outside Docker, install from [rtk-ai/rtk releases](https://github.com/rtk-ai/rtk/releases).

### API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/rtk/status` | GET | Binary availability, env/user toggles, last compression stats |

### Clients

- **Terminal:** `/rtk on|off|status|gain`
- **Web:** Settings → Token Saver → RTK toggle

---

## Phase 8 — Agent memory

### Native memory

Stored in Postgres (`agent_memories`) with vector index in Qdrant (`type=agent_memory`). Injected into `stream_session` via `memory_service.compose_memory_context`.

**Capture triggers:**

- `POST /api/v1/memory/save` or terminal `/memory save`
- `/compact` workflow summary extraction
- Approved proposals with architectural notes

### API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/memory` | GET | List memories (`?project_path=`, `?scope=`) |
| `/api/v1/memory/search` | GET | Semantic search (`?q=`) |
| `/api/v1/memory/save` | POST | Save a memory entry |
| `/api/v1/memory/export` | GET | Export all memories |

### Supermemory BYOK (optional)

Requires [Supermemory Pro](https://supermemory.ai/docs/integrations/claude-code) and `SUPERMEMORY_CC_API_KEY`.

Per-repo overrides: copy [`.codeforge/supermemory.json.example`](../.codeforge/supermemory.json.example) to `<project>/.codeforge/supermemory.json`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/supermemory/status` | GET | Connector status |
| `/api/v1/supermemory/search` | GET | Search Supermemory (`?q=`, `?scope=`) |
| `/api/v1/supermemory/save` | POST | Save to Supermemory |

Search order in combined `/api/v1/memory/search`: native memory first, then Supermemory when configured.

### Clients

- **Terminal:** `/memory search|save|list|export`, `/supermemory status|search|save`
- **Web:** Settings → Memory tab

---

## Phase 9 — ScrapeGraphAI Cowork extraction

Natural-language extraction from URLs or workspace files. Results ingest into project knowledge (Qdrant) and agent memory.

### Requirements

- `OPENAI_API_KEY` (or compatible LiteLLM provider) for `SmartScraperGraph`
- `scrapegraphai` in API image (`requirements.txt`)
- `CODEFORGE_SCRAPE_ENABLED=true`

### API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/cowork/scrape` | POST | One-shot scrape with approval flag |
| `/api/v1/cowork/plans` | POST | Plan with `task_type: "scrape"` |

**Request fields:**

| Field | Description |
|-------|-------------|
| `scrape_prompt` | What to extract (natural language) |
| `url` | HTTP(S) page to scrape |
| `source_path` | Workspace-relative file (HTML, JSON, MD, etc.) |
| `approved` | Must be `true` to execute |
| `ingest_knowledge` | Push excerpt into session knowledge (default `true`) |
| `ingest_memory` | Push excerpt into agent memory (default `true`) |

### Guardrails

- Approval required (same as browser tasks)
- URL validation (`http`/`https` only)
- `source_path` must stay inside project workspace
- Scheduled jobs cannot run scrape tasks
- httpx fallback excerpt when ScrapeGraphAI fails on URLs only

### Clients

- **Terminal:** `/cowork scrape <url> --prompt <text> [--approve]`, `/cowork scrape file <path> --prompt <text>`
- **Web:** Cowork → Scrape plan type or Quick scrape on Extractions tab

---

## Shared client helpers

`packages/shared/src/api.js` exports helpers for all extension APIs:

- Taste: `getTasteRules`, `getTasteStats`, `exportTaste`, `importTaste`
- Skills: `listSkills`, `getAgentPreferences`, `updateAgentPreferences`
- RTK: `getRtkStatus`
- Memory: `listMemories`, `searchMemory`, `saveMemory`, `exportMemory`
- Supermemory: `getSupermemoryStatus`, `searchSupermemory`, `saveSupermemory`
- Scrape: `scrapeCoworkData`

Used by web (`apps/web/lib/api.js`), terminal, desktop, and VS Code clients.

---

## Environment variables

Copy from [`.env.example`](../.env.example):

| Variable | Default | Purpose |
|----------|---------|---------|
| `CODEFORGE_RTK_ENABLED` | `false` | Global RTK shell compression |
| `CODEFORGE_RTK_DEBUG` | `false` | Attach raw tail on non-zero exit |
| `CODEFORGE_RTK_BINARY` | — | Explicit `rtk` binary path |
| `SUPERMEMORY_CC_API_KEY` | — | Supermemory BYOK API key |
| `SUPERMEMORY_API_URL` | `https://api.supermemory.ai` | Supermemory API base |
| `CODEFORGE_SCRAPE_ENABLED` | `true` | Enable ScrapeGraphAI Cowork tasks |
| `CODEFORGE_SCRAPE_MODEL` | — | Override scrape model (defaults to synthesis model) |
| `CODEFORGE_SCRAPE_VERBOSE` | `false` | Verbose ScrapeGraphAI logging |

---

## Tests

```bash
cd services/api
source .venv/bin/activate   # or create venv per README
pip install -r requirements.txt
CODEFORGE_ENV=development pytest tests/test_taste.py tests/test_rtk.py \
  tests/test_memory.py tests/test_scrape.py tests/test_skills.py -v
```

Or from repo root: `npm run api:test` (runs full suite; add `--timeout=60` if SSE cases hang).

---

## Related docs

- [phase-7-taste.md](tickets/phase-7-taste.md) — taste architecture and tickets
- [phase-8-memory.md](tickets/phase-8-memory.md) — RTK + memory implementation notes
- [phase-9-scrape.md](tickets/phase-9-scrape.md) — ScrapeGraphAI Cowork extraction
- [phase-10-anthropic-skills.md](tickets/phase-10-anthropic-skills.md) — curated skills pack
- [DEPLOYMENT_RUNBOOK.md](../DEPLOYMENT_RUNBOOK.md) — operator verification (sections 14–17)
