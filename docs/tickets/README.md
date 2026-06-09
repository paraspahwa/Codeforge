# CodeForge Ticket Backlog

This backlog turns [docs/implementation-plan.md](../implementation-plan.md) into implementation-sized tickets.

## Status Overview

Core backend + primary surfaces (Phases 0–2) are largely in place. Phases 3–6 have **shipped slices** but several **exit criteria and surface-parity items remain open** — see each phase file for caveats.

Completed or in place:

- Phase 0 stream contract and startup validation (CI smoke via `docker-compose.prod.yml`)
- Phase 1 Code Mode Core (file ops, git, shell sandbox, routing, usage limits)
- Phase 1 terminal parity (split panes, palette, approvals)
- Phase 2 platform surfaces (web, desktop Code workspace, VS Code panel, shared SDK)
- Phase 3 advanced code workflows (loop, compact, ultrareview, multi-file plan/rollback on terminal/desktop/VS Code)
- Phase 4 cowork mode (API + DB persistence, Playwright browser with httpx fallback, web `/cowork`, desktop CoworkWorkspace)
- Phase 5 team platform (API + DB persistence, web `/team`, share-resume `/share/[id]`, delegation execute)
- Phase 6 routing quality (tier-bound policy, benchmark baselines/trends, confidence on web chat + terminal)
- Shared client helpers for file, git, shell, context packs, MCP, team, and cowork APIs

Partially complete:

- Phase 3: parallel sessions and auto mode missing on terminal; artifacts/remote/custom agents not started
- Phase 4: OCR is path-based Tesseract only (no screenshot capture); terminal/VS Code cowork UI shipped in build order item 3
- Phase 5: team UI on web + terminal/VS Code; audit log + knowledge upload API shipped; no SSO or real-time team updates
- Phase 6: routing eval regressions are CI warnings; quality benchmark (`swe-fixtures`) is fail-closed in deploy smoke test

Still ahead (cross-cutting):

- ~~ECS worker deploy for background cowork/jobs~~ (shipped: worker service + Celery beat scheduler)
- Enterprise: SSO, org-scoped rate limits
- Surface parity matrix (team/cowork/confidence on desktop, terminal, VS Code)
- ~~SWE-bench-style internal quality eval harness~~ (shipped: `quality-benchmark` + CI gate)
- Phase 3 stretch: artifacts/live preview, remote control, custom agents

## Ticket Order

1. [Phase 0 - Foundation](phase-0-foundation.md)
2. [Phase 1 - Code Mode Core](phase-1-code-mode.md)
3. [Phase 1 - Terminal Parity](phase-1-terminal.md)
4. [Phase 2 - Platform Surfaces](phase-2-platform-surface.md)
5. [Phase 3 - Advanced Code Features](phase-3-advanced-code.md)
6. [Phase 4 - Cowork Mode](phase-4-cowork.md)
7. [Phase 5 - Projects and Team Platform](phase-5-projects-team.md)
8. [Phase 6 - Quality and Routing](phase-6-quality-routing.md)

## How To Use

- Treat each file as a parent ticket or epic.
- Break the subtasks into smaller GitHub issues if needed.
- Keep implementation order aligned with the plan unless a dependency forces a reordering.
- Update the backlog when the implementation plan changes.
