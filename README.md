# CodeForge

India-first Claude Code alternative with four user modes on one shared backend:

- Chat for web and mobile-friendly assistant workflows
- Code for terminal, desktop, and VS Code coding workflows
- Cowork for desktop automation and non-coding ops tasks
- Projects for shared memory, RAG, session history, and team context

## Current Status

This repository already includes the core platform scaffold:

- FastAPI backend with dev auth, sessions, messages, SSE streaming, usage analytics, billing foundations, and OpenTelemetry tracing
- Next.js web dashboard with login, session history, chat, analytics, billing, and proposal review UI
- Tauri desktop shell with tray, folder picker, notifications, and global shortcut wiring
- Ink-based terminal client with shared API helpers and structured stream rendering
- Shared client package for API and SSE helpers, including context-manager and MCP connector APIs
- Implementation plan and roadmap docs under `docs/`

Current implementation focus: production orchestration hardening and deeper git conflict-handling UX polish.

## Repository Layout

- `apps/web`: Next.js dashboard and chat surface
- `apps/desktop`: React frontend plus Tauri shell
- `apps/terminal`: Ink terminal client
- `packages/shared`: Shared API and stream helpers
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
- MCP connector registry, enable/disable controls, and authenticated tool invocation boundary
- Synthesis rollout status endpoint for provider strategy/selection visibility
- Guided git conflict-resolution endpoint and terminal workflow command
- Web dashboard panels for usage, billing, activity, and proposal review
- Desktop shell scaffold with native integrations
- Terminal client scaffold with shared streaming helpers

## Known Gaps

- External model synthesis rollout now includes environment-specific planning and readiness validation, but deployment-time policy enforcement gates are still pending
- Routing benchmark suites now include policy and repository-grounded checks, but benchmark history and regression alerting are still pending

## Canonical Documents

- [Implementation plan](docs/implementation-plan.md)
- [Product requirements](PRD.md)
- [Spec index](INDEX.md)
- [Roadmap tickets](docs/tickets/README.md)
