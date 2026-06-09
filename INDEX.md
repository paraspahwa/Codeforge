# CodeForge Spec Index

## Reading Order

1. Start with [PRD.md](PRD.md) for the product definition and roadmap.
2. Read [docs/implementation-plan.md](docs/implementation-plan.md) for the phased execution plan.
3. Use [docs/tickets/README.md](docs/tickets/README.md) for implementation tickets and build order.
4. Use this file as a pointer map when handing tasks to GitHub Copilot.

## Primary Documents

- [PRD.md](PRD.md): product scope, phases, and success metrics
- [docs/implementation-plan.md](docs/implementation-plan.md): execution plan and delivery order
- [docs/tickets/README.md](docs/tickets/README.md): ticket backlog and phase slices
- [README.md](README.md): repo setup and current implementation status

## Suggested Copilot Prompts

### Backend Foundation

Build the shared FastAPI backend slice from `docs/tickets/phase-0-foundation.md`, keeping the current session model and streaming events intact.

### Code Mode Core

Implement the file operations, diff preview, approval, and apply flow from `docs/tickets/phase-1-code-mode.md`.

### Terminal Parity

Extend the Ink terminal client according to `docs/tickets/phase-1-terminal.md` so it can render approvals, diffs, and session history.

### Platform Surfaces

Improve the web and desktop clients from `docs/tickets/phase-2-platform-surface.md` and keep them on the shared API contract.

## Current Technical Direction

- Backend: FastAPI + Python 3.13
- Web: Next.js + React
- Desktop: Tauri + React
- Terminal: Ink + React
- Shared package: browser/node API helpers and SSE parsing

## Backlog Areas (active)

- Surface parity: team, cowork, and confidence UX on desktop Code, terminal, and VS Code
- ECS worker deploy for background cowork jobs
- SWE-bench-style internal quality eval harness
- Enterprise: SSO, audit trail, knowledge uploads, real-time team sync
- Phase 3 stretch: web loop UI, artifacts/live preview, remote channels, custom agents
- Fail-closed routing regression deploy gates

## Notes

The current repo intentionally tracks the roadmap in docs first. The tickets under `docs/tickets/` are the build queue for Copilot or a human implementer.
