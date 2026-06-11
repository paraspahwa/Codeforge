# CodeForge API

FastAPI backend for sessions, streaming agent runs, billing, cowork/team workflows, and agent personalization (taste, memory, RTK, skills).

## Quick start

```bash
cd services/api
python3.13 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Copy environment variables from the repo root [`.env.example`](../../.env.example). For local development, SQLite is used when `DATABASE_URL` is unset.

### Smoke test

```bash
source .venv/bin/activate
CODEFORGE_ENV=development python -m pytest tests/ -q
```

Run a focused slice when working on a subsystem:

| Subsystem | Test file |
|-----------|-----------|
| Taste | `tests/test_taste.py` |
| Memory + Supermemory | `tests/test_memory.py` |
| RTK shell compression | `tests/test_rtk.py` |
| Skills + caveman | `tests/test_skills.py` |
| ScrapeGraphAI | `tests/test_scrape.py` |
| Cowork | `tests/test_cowork.py` |
| Team / projects | `tests/test_projects_team.py` |

## Layout

```
app/
  main.py              # Route registration, SSE stream, proposal decisions
  agent.py             # Intent routing, synthesis, SSE event serialization
  agent_loop.py        # Verify/fix loop orchestration
  routers/             # Focused routers (taste, memory, rtk, skills, platform)
  taste_service.py     # Proposal feedback → taste rules → prompt injection
  memory_service.py    # Native agent memory + Qdrant vector index
  skills_service.py    # .codeforge/skills playbooks + caveman token saver
  rtk_service.py       # Optional rtk binary wrapper for shell output compression
  scrape_service.py    # ScrapeGraphAI Cowork extraction
  supermemory_connector.py  # BYOK Supermemory cloud memory
  cowork.py            # Cowork plans, jobs, browser tasks, scrape
  projects_team.py     # Workspaces, knowledge, delegations, style guides
  shell_ops.py         # Sandboxed shell execution (RTK-aware)
  vector_store.py      # Qdrant upsert/search for knowledge + memories
  celery_worker.py     # Background cowork ticks (production worker image)
tests/                 # Pytest suite (asyncio auto mode)
migrations/            # Alembic schema migrations
```

Bundled agent skills live at [`.codeforge/skills/`](../../.codeforge/skills/). Project repos can override bundled skills with the same name under `{repo}/.codeforge/skills/`.

## Request flow

```
Client POST /api/v1/sessions/{id}/messages
        │
        ▼
  route_request() ──► model tier + confidence
        │
        ▼
  stream_session (SSE)
        ├─ compose_taste_context()     ← taste rules + team style guides
        ├─ compose_memory_context()    ← native memory + optional Supermemory
        ├─ compose_agent_instructions()← enabled skills + caveman mode
        └─ synthesis + tool calls (file/git/shell/MCP)
```

Proposal approve/reject decisions feed taste events and can trigger memory capture when notes contain architectural signals.

## Agent personalization (Phases 7–10)

Detailed ticket specs live under [`docs/tickets/`](../../docs/tickets/). This section covers developer-facing APIs and integration points.

### Taste (Phase 7)

Learns coding preferences from proposal feedback and injects rules into the agent system prompt.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/taste/rules` | Active rules + rendered `taste.md` |
| `GET /api/v1/taste/stats` | Approval/rejection metrics |
| `GET /api/v1/taste/export` | Export taste pack for team sync |
| `POST /api/v1/taste/import` | Import taste pack |

Proposal decisions accept optional `note` and `edited_content` fields. Events are distilled heuristically in `taste_service._distill_rules()` and capped at 50 rules per user.

### Skills + token saver (Phases 7 + 10)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/skills` | List bundled + project skills |
| `GET /api/v1/skills/{name}` | Load full `SKILL.md` body |
| `GET /api/v1/agent/preferences` | `caveman_mode`, `enabled_skills`, `rtk_enabled` |
| `PUT /api/v1/agent/preferences` | Update preferences |

Caveman modes: `off`, `lite`, `full`, `ultra`. Enabled skill bodies are truncated (~2500 chars each) when injected via `skills_service.compose_agent_instructions()`.

### RTK shell compression (Phase 8)

Optional wrapper around read-only shell commands (`git status`, `pytest`, `rg`, etc.) using the [`rtk`](https://github.com/rtk-ai/rtk) binary.

| Control | Effect |
|---------|--------|
| `CODEFORGE_RTK_ENABLED=true` | Force-enable for all users |
| `CODEFORGE_RTK_BINARY=/path/to/rtk` | Override binary lookup |
| User preference `rtk_enabled` | Per-user toggle via Settings or `/rtk on\|off` |
| `GET /api/v1/rtk/status` | Binary availability + last compression stats |

RTK only applies to commands deemed safe in `rtk_service.is_rtk_supported_command()`. Stats are stored in `user_agent_preferences.rtk_last_stats_json`.

### Native memory + Supermemory (Phase 8)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/memory` | List memories (optional `project_path`, `scope` filters) |
| `GET /api/v1/memory/search?q=` | Native search, then Supermemory when configured |
| `POST /api/v1/memory/save` | Persist a memory (`scope`: `personal` or `team`) |
| `GET /api/v1/memory/export` | Export memory pack |
| `GET /api/v1/supermemory/status` | BYOK configuration status |
| `GET /api/v1/supermemory/search` | Supermemory-only search (501 if not configured) |
| `POST /api/v1/supermemory/save` | Save to Supermemory cloud |

**Capture triggers** (automatic, no API call needed):

- Explicit `POST /api/v1/memory/save` or terminal `/memory save`
- `/workflows/compact` summary signal extraction
- Approved proposals with architectural notes

Memories are stored in `agent_memories` (Postgres/SQLite) and indexed in Qdrant via `vector_store.upsert_text` with `type=agent_memory`. Configure Qdrant with `QDRANT_URL` (see [docs/qdrant-ecs-setup.md](../../docs/qdrant-ecs-setup.md)).

**Supermemory BYOK:**

- Env: `SUPERMEMORY_CC_API_KEY`
- Per-repo: `.codeforge/supermemory.json` (see [`.codeforge/supermemory.json.example`](../../.codeforge/supermemory.json.example))

### ScrapeGraphAI (Phase 9)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/cowork/scrape` | One-shot URL/file extraction |
| `POST /api/v1/cowork/plans` with `task_type: "scrape"` | Preview + run flow |

Requires `OPENAI_API_KEY` for SmartScraperGraph. Set `CODEFORGE_SCRAPE_ENABLED=true`. Execution requires `approved: true`. Output can ingest into project knowledge (Qdrant) and agent memory.

## Auth

| Mode | Endpoints |
|------|-----------|
| Dev login | `POST /api/v1/auth/dev-login` (disabled when OIDC is on unless `CODEFORGE_ALLOW_DEV_LOGIN=true`) |
| OIDC | `/api/v1/auth/oidc/*` — see [docs/oidc-idp-checklist.md](../../docs/oidc-idp-checklist.md) |

All `/api/v1/*` routes except billing webhook and public share resolve require `Authorization: Bearer <jwt>`.

## Production notes

- **API image**: `Dockerfile` — set `CODEFORGE_COWORK_SCHEDULER_ENABLED=false` so cowork ticks run on the worker only.
- **Worker image**: `Dockerfile.worker` — Celery beat + Playwright Chromium for browser/scrape jobs.
- **Deploy readiness**: `GET /api/v1/platform/deploy-readiness` probes OIDC, billing, Qdrant, and related config.

See [DEPLOYMENT_RUNBOOK.md](../../DEPLOYMENT_RUNBOOK.md) for ECS deploy steps.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Taste rules not appearing | Confirm proposal decisions include `note`; inspect `GET /api/v1/taste/stats` |
| Memory search returns nothing | `QDRANT_URL` reachable; `OPENAI_API_KEY` set for embeddings |
| RTK not compressing output | `GET /api/v1/rtk/status` — binary must be on `PATH` or `CODEFORGE_RTK_BINARY` |
| Supermemory 501 | Set `SUPERMEMORY_CC_API_KEY` or repo `.codeforge/supermemory.json` |
| Scrape fails | `OPENAI_API_KEY` + `CODEFORGE_SCRAPE_ENABLED=true`; URL must be `http`/`https` |
| Skills not injected | `enabled_skills` in agent preferences; skill must exist in bundled or project `.codeforge/skills/` |
| Dev login 403 | OIDC enabled — use SSO or set `CODEFORGE_ALLOW_DEV_LOGIN=true` for CI |

## Related docs

- [Phase 7 — Taste](../../docs/tickets/phase-7-taste.md)
- [Phase 8 — RTK + Memory](../../docs/tickets/phase-8-memory.md)
- [Phase 9 — Scrape](../../docs/tickets/phase-9-scrape.md)
- [Phase 10 — Anthropic Skills](../../docs/tickets/phase-10-anthropic-skills.md)
- [Agent skills layout](../../.codeforge/skills/README.md)
