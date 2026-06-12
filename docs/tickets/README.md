# CodeForge Ticket Backlog

This backlog turns [docs/implementation-plan.md](../implementation-plan.md) into implementation-sized tickets.

## Status Overview

Core backend + primary surfaces (Phases 0–6) are largely complete. Remaining work is mostly enterprise hardening (full OIDC/JWKS verification, screenshot OCR) and optional polish.

Completed or in place:

- Phase 0 stream contract and startup validation (CI smoke via `docker-compose.prod.yml`)
- Phase 1 Code Mode Core (file ops, git, shell sandbox, routing, usage limits)
- Phase 1 terminal parity (split panes, palette, approvals)
- Phase 2 platform surfaces (web, desktop Code workspace, VS Code panel, shared SDK)
- Phase 3 advanced code workflows (loop, compact, ultrareview, multi-file plan/rollback on terminal/desktop/VS Code)
- Phase 3 stretch: fork/auto mode, artifacts preview, custom agent templates, remote control channels (pairing + SSE push)
- Phase 4 cowork mode (API + DB persistence, Playwright browser with httpx fallback, web `/cowork`, desktop CoworkWorkspace, terminal/VS Code jobs+browser)
- Phase 5 team platform (API + DB persistence, web `/team`, desktop Team mode, terminal/VS Code team parity, audit log, knowledge upload, team SSE)
- Phase 6 routing quality (tier-bound policy, benchmark baselines/trends, confidence on all coding surfaces, fail-closed routing + quality CI gates)
- ECS worker deploy for background cowork/jobs (Celery beat scheduler)
- SWE-bench-style internal quality eval harness (`quality-benchmark` + CI gate)
- Shared client helpers for file, git, shell, context packs, MCP, team, cowork, remote channels, and SSE streams
- Phase 7 taste + skills (proposal feedback → taste rules; `.codeforge/skills/` playbooks; bundled caveman token-saver; `/caveman` + Settings → Token Saver)
- Phase 8 RTK + memory (shell output compression; Postgres/Qdrant agent memory; Supermemory BYOK)
- Phase 9 ScrapeGraphAI Cowork extraction (URL scrape → project knowledge + memory)
- Phase 10 Anthropic skills pack (frontend-design, webapp-testing, mcp-builder, skill-creator, doc-coauthoring)
- Web `/code` workspace (git sidebar, shell stream, file preview, verify loop, chat)
- Web in-chat slash commands (`/memory`, `/taste`, `/caveman`, `/rtk`, `/supermemory`, `/help`)
- PWA manifest + mobile-friendly chat layout
- Web OIDC login/callback + Settings → SSO readiness checklist
- Desktop settings (taste, memory, RTK, skills), analytics, billing, cowork scrape UI
- Phase 11 Hermes Agent adapter (optional sidecar engine, settings toggle, SSE bridge)
- Delegation step-approval gates (`require_step_approval`, approve-step on all clients)
- Session grants + share/delegation write enforcement (`session_access.py`)

Partially complete:

- Production OIDC: SSO UI on web/desktop; IdP app registration + ECS SSM `CODEFORGE_OIDC_*` are operator tasks
- Enterprise: org-scoped workspace rate limits shipped; billing-tier org entities not modeled
- Terminal/VS Code OIDC uses paste-code flow (desktop has native SSO button)

Still ahead (lower priority):

- Native mobile app (web PWA covers mobile-friendly chat)
- PRD long-horizon: voice, design-to-code, localization

## Ticket Order

1. [Phase 0 - Foundation](phase-0-foundation.md)
2. [Phase 1 - Code Mode Core](phase-1-code-mode.md)
3. [Phase 1 - Terminal Parity](phase-1-terminal.md)
4. [Phase 2 - Platform Surfaces](phase-2-platform-surface.md)
5. [Phase 3 - Advanced Code Features](phase-3-advanced-code.md)
6. [Phase 4 - Cowork Mode](phase-4-cowork.md)
7. [Phase 5 - Projects and Team Platform](phase-5-projects-team.md)
8. [Phase 6 - Quality and Routing](phase-6-quality-routing.md)
9. [Phase 7 - Taste (Coding Preferences)](phase-7-taste.md)
10. [Phase 8 - RTK and Memory](phase-8-memory.md)
11. [Phase 9 - ScrapeGraphAI](phase-9-scrape.md)
12. [Phase 10 - Anthropic Skills](phase-10-anthropic-skills.md)
13. [Phase 11 - Hermes Agent](phase-11-hermes.md)

## How To Use

- Treat each file as a parent ticket or epic.
- Break the subtasks into smaller GitHub issues if needed.
- Keep implementation order aligned with the plan unless a dependency forces a reordering.
- Update the backlog when the implementation plan changes.
