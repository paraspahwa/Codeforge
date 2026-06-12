# CodeForge

India-first Claude Code alternative with four user modes on one shared backend:

- Chat for web and mobile-friendly assistant workflows (PWA, slash commands)
- Code for terminal, desktop, and VS Code coding workflows
- Cowork for desktop and web automation, ScrapeGraphAI extraction, and non-coding ops tasks
- Projects for shared memory (Postgres/Qdrant + Supermemory BYOK), taste rules, RTK compression, agent skills, RAG, session history, and team context

## Current Status

This repository includes a working multi-surface coding assistant platform:

- FastAPI backend with dev auth, sessions, messages, SSE streaming, usage limits, billing, cowork/team APIs, routing benchmarks, and OpenTelemetry tracing
- Next.js web app: chat, **Code workspace** (`/code`), sessions/replay, analytics, billing, settings (taste, memory, RTK, skills), **Team** (`/team`), **Cowork** (`/cowork` + scrape), share-resume (`/share/[id]`), PWA manifest, in-chat slash commands
- Tauri desktop: **Code** workspace (git, shell, slash commands, loop, proposals), **Cowork** (incl. ScrapeGraphAI), **Settings** (taste, memory, RTK, skills), **Analytics**, **Billing**
- Ink terminal: split-pane coding UI with confidence/routing banner, git, loop, plan/rollback
- VS Code extension: backend-backed panel with loop, compact, ultrareview, fork, auto mode
- Shared client package for API, SSE, team, cowork, context packs, and MCP helpers

Current implementation focus: surface parity (team/cowork/confidence on all clients), ECS worker deploy, and SWE-bench-style quality evals.

## Repository Layout

- `apps/web`: Next.js dashboard and chat surface — see [apps/web/README.md](apps/web/README.md)
- `apps/desktop`: React frontend plus Tauri shell — see [apps/desktop/README.md](apps/desktop/README.md)
- `apps/terminal`: Ink terminal client
- `packages/ui`: Shared React components (`ChatMessageList`, buttons, panels) — see [packages/ui/README.md](packages/ui/README.md)
- `packages/design-tokens`: Shared `--cf-*` CSS tokens and `theme.json` — see [packages/design-tokens/README.md](packages/design-tokens/README.md)
- `packages/shared`: Cross-client API, SSE, and session-grant helpers — see [packages/shared/README.md](packages/shared/README.md)
- `services/api`: FastAPI backend
- `docs/`: PRD, implementation plan, index, and tickets

## Local Setup

### Runtime Assumptions

- Backend API: Python 3.13 with `services/api/.venv`
- Web app: Node.js with the root workspace dependencies installed
- Desktop app: Rust toolchain available for Tauri
- Terminal app: Node.js workspace runtime with the shared client package

### Runtime Matrix

| Surface | Runtime | Entry command | Key environment variables |
| --- | --- | --- | --- |
| API | Python 3.13 venv in `services/api/.venv` | `uvicorn app.main:app --reload --port 8000` | `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `OTEL_SERVICE_NAME`, `OTEL_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Web | Node.js workspace | `npm run dev:web` | `NEXT_PUBLIC_API_BASE` |
| Desktop | Node.js + Rust (Tauri) | `npm run dev:desktop` | `CODEFORGE_API_BASE_URL` |
| Terminal | Node.js workspace | `npm run dev:terminal` | `CODEFORGE_API_BASE_URL`, `CODEFORGE_USER_ID`, `CODEFORGE_MODEL` |

### Backend API

```bash
cd services/api
py -3.13 -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Python 3.13 is the supported local runtime for this backend.

Optional environment variables:

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
RAZORPAY_KEY_ID=rzp_live_or_test_key
RAZORPAY_KEY_SECRET=rzp_live_or_test_secret
OTEL_SERVICE_NAME=codeforge-api
OTEL_ENVIRONMENT=local
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
CODEFORGE_API_BASE_URL=http://127.0.0.1:8000
CODEFORGE_USER_ID=paras
CODEFORGE_MODEL=deepseek-v4-flash
OPENAI_API_KEY=optional_openai_key_for_synthesis
OPENAI_BASE_URL=https://api.openai.com/v1
CODEFORGE_SYNTHESIS_MODEL=gpt-4o-mini
```

If `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, the API falls back to console span export so local traces are still visible during development.

The API uses the database, auth, billing, and tracing variables above. The terminal client reads `CODEFORGE_API_BASE_URL`, `CODEFORGE_USER_ID`, and `CODEFORGE_MODEL` for local defaults.

### Web App

```bash
npm install
npm run dev:web
```

### Desktop App

```bash
npm run dev:desktop
```

Tauri dev/build requires the Rust toolchain.

### Terminal App

```bash
npm run dev:terminal
```

## What Is Implemented

- Dev login for local auth testing
- Session creation and listing
- Message persistence and history
- Structured SSE streaming
- Request and agent-flow tracing with `x-trace-id` response headers and streamed `trace_id` payloads
- Usage summaries
- Billing plan, order, verify, subscription, and webhook APIs
- Proposal review flow for streamed diffs
- Context packs with session attach/compose APIs for reusable project memory
- MCP connector registry, enable/disable controls, HTTP JSON-RPC remote transport, and authenticated tool invocation boundary
- Organization entities with workspace linkage, workspace session grants, and org-aware billing context (`/api/v1/billing/context`)
- Synthesis rollout status endpoint for provider strategy/selection visibility
- Guided git conflict-resolution endpoint and terminal workflow command
- Web dashboard: usage, billing, analytics with routing benchmarks, team/cowork admin pages, proposal review
- Desktop Code + Cowork workspaces with Tauri tray, notifications, folder picker
- Terminal split-pane client with routing confidence display and advanced workflows
- VS Code panel with editor-context sync and workflow commands
- DB-backed cowork and team persistence (plans, workspaces, shares, delegations)
- Tier-bound routing policy with benchmark baselines/trends and regression evaluation
- **Phase 7** taste rules + agent skills (caveman token saver, `.codeforge/skills/` playbooks)
- **Phase 8** RTK shell compression, native agent memory (Postgres/Qdrant), Supermemory BYOK
- **Phase 9** ScrapeGraphAI Cowork extraction into project knowledge + memory
- **Phase 10** curated Anthropic skills pack (`frontend-design`, `webapp-testing`, `mcp-builder`, `skill-creator`, `doc-coauthoring`)

## Web surfaces

| Route | Purpose |
|-------|---------|
| `/` | Chat with proposals, workflows, slash commands (`/memory`, `/taste`, `/caveman`, `/rtk`, `/help`) |
| `/code` | Code workspace — git sidebar, shell, file preview, verify loop |
| `/sessions` | Session list and replay |
| `/login` | Dev login or SSO (redirects authenticated users to `?next=` path) |
| `/settings` | Taste, memory, token saver/skills, MCP, SSO checklist, deploy readiness |
| `/cowork` | Cowork plans, browser tasks, ScrapeGraphAI quick scrape |
| `/team` | Workspaces, knowledge, delegations |
| `/analytics` | Usage and routing benchmarks |
| `/billing` | Plans and Razorpay checkout |
| `/share/[shareId]` | Shared session resume (minimal shell, no sidebar) |

Install as PWA: browsers can add CodeForge to the home screen via `manifest.webmanifest` (mobile-friendly chat layout).

Frontend architecture (hooks, shell routing, shared packages): [apps/web/README.md](apps/web/README.md).

## Testing

```bash
cd services/api
.venv\Scripts\activate   # or source .venv/bin/activate
pytest tests/test_taste.py tests/test_memory.py tests/test_rtk.py tests/test_skills.py tests/test_scrape.py -q
pytest tests/ -q         # full suite; conftest forces SQLite + in-memory vectors per test (ignores .env.local Supabase/Qdrant)
```

`tests/conftest.py` clears `DATABASE_URL` and `QDRANT_URL` on each test so local `.env.local` does not slow tests or hit remote services.

## Known Gaps

- Production OIDC requires IdP app registration plus ECS SSM secrets (`CODEFORGE_OIDC_*`) and worker ECR repo `codeforge-worker`
- ECS worker task definitions ship with `fs-PLACEHOLDER` EFS mounts — replace before cloud delegations/cowork file jobs
- Production IdP: populate ECS SSM `CODEFORGE_OIDC_*` parameters and register all redirect URIs at the IdP
- Worker ECS deploy requires GitHub variables `EFS_FILE_SYSTEM_ID_STAGING` and `EFS_FILE_SYSTEM_ID_PRODUCTION`
- Terminal and VS Code OIDC use paste-code completion flows; register `http://127.0.0.1:4583/auth/callback` and `http://127.0.0.1:4584/auth/callback` at the IdP when enabling SSO
- Long-horizon PRD items remain open: voice control, design-to-code, native mobile, localization

## Deploy Notes

- CI builds and deploys separate API, web, and worker images
- **Worker image**: built from `services/api/Dockerfile.worker` (Playwright Chromium + Celery worker/beat). GitHub Actions pushes to ECR repo `codeforge-worker` (set `ECR_REPOSITORY_WORKER` or let deploy workflow auto-create the repo). Use `infra/ecs/{staging,production}/taskdef-worker.json` for ECS — not the legacy root `infra/ecs/taskdef-api.json`.
- **API image**: `services/api/Dockerfile`. Set `CODEFORGE_COWORK_SCHEDULER_ENABLED=false` on API tasks in production so the in-process cowork loop stays off; scheduled cowork ticks run via Celery beat on the worker service.
- Smoke tests enqueue `queue-ping` and poll `GET /api/v1/platform/queue-ping/{job_id}` until the worker reports success
- Worker EFS: set GitHub vars `EFS_FILE_SYSTEM_ID_STAGING` / `EFS_FILE_SYSTEM_ID_PRODUCTION`; deploy patches `fs-PLACEHOLDER` in worker taskdefs via `scripts/patch_ecs_worker_efs.py`
- OIDC: populate ECS SSM `CODEFORGE_OIDC_*` parameters (see `docs/deployment-assets-setup.md`). Redirect URIs: web `http://localhost:3000/auth/callback`, desktop `http://localhost:1420/auth/callback`, terminal `http://127.0.0.1:4583/auth/callback`, VS Code `http://127.0.0.1:4584/auth/callback`

## Canonical Documents

- [Production deployment checklist](docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md) — cheapest paths (VPS, Vercel + Supabase + Cloudflare), all API keys, your tick-list
- [Implementation plan](docs/implementation-plan.md)
- [Product requirements](PRD.md)
- [Spec index](INDEX.md)
- [Roadmap tickets](docs/tickets/README.md)
