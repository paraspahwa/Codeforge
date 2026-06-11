# CodeForge Implementation Plan

## Product Goal

Build an India-first Claude Code alternative with four user modes on one shared backend:

- Chat: web and mobile-friendly assistant surface
- Code: terminal, desktop, and VS Code coding workflow
- Cowork: desktop automation for non-coding and ops tasks
- Projects: shared memory, RAG, session history, and team context

Target positioning:

- Lite: INR 199
- Pro: INR 499
- Team: INR 1299
- Enterprise: custom pricing with frontier-model fallback

## Current State

Already implemented in this repo:

- FastAPI API with dev auth, session creation, message persistence, SSE streaming, usage analytics, billing foundations, OpenTelemetry tracing, file ops, git status/diff/log/worktree/merge-assist, and a shell sandbox stream
- Shared event contract and client helpers for agent runs, file preview/apply, git inspection, worktrees, merge-assist, and shell execution
- Intent routing and usage-limit enforcement with plan-aware request caps and routing reasons
- Next.js web app with login, session history, chat, analytics cards, billing plans, checkout integration, and subscription state
- Tauri desktop scaffold with tray, notifications, folder picker, global shortcut, and successful Rust compile validation
- Ink-based terminal client with shared API helpers, `/git` commands, `/run` shell commands, split-pane file/chat/diff/activity layout, proposal approval actions, mode-aware pane navigation, `/compact`, `/ultrareview`, mode shortcuts, and startup validation
- VS Code extension MVP with a backend-backed panel, inline proposal diff preview, live editor-context sync, status bar actions, editor title actions, and explain/refactor/review command entry points
- Phase 1 terminal parity and Phase 2 platform surfaces are implemented across their attached tickets
- Phase 4 cowork mode: DB-backed plans/runs/jobs/extractions, Playwright browser tasks, web `/cowork` and desktop CoworkWorkspace, explicit browser approval boundaries
- Phase 5 team platform: DB-backed workspaces/knowledge/shares/delegations, web `/team` and `/share/[id]`, knowledge injected into agent stream, delegation execute endpoint
- Phase 6 routing quality: tier-bound routing policy, benchmark baselines/trends with regression evaluation, confidence signals on web chat and terminal
- Context manager and MCP v1 groundwork are implemented with reusable context packs, session context composition, connector registry, and authenticated MCP tool-invoke endpoints
- Shared stream orchestration has been hardened with run-generated token chunks, inline static verification signals, and single-authority completion events
- Model-backed response synthesis path is integrated with deterministic fallback and synthesis-source observability in stream payloads
- Git safety guardrails are hardened with staged-only commits, conflict blocking, merge risk signals, and safety recommendations
- Synthesis rollout observability endpoint is available to inspect provider strategy/selection across environments
- Guided conflict-resolution flow is available via API and terminal command workflow with actionable resolution steps
- Explicit runtime/config documentation for backend, web, terminal, and tracing assumptions
- Shared workspace scripts for web, desktop, terminal, and API flows

Partially started:

- Phase 7 taste + skills: proposal feedback capture, taste context, `.codeforge/skills/` discovery, bundled caveman token-saver (MIT), agent preferences API (see [phase-7-taste.md](tickets/phase-7-taste.md))

Still missing for the full roadmap:

- Production IdP rollout (ECS SSM OIDC parameters and redirect URI registration at the IdP)
- GitHub `EFS_FILE_SYSTEM_ID_*` variables for worker ECS deploy (workflow injects into taskdefs)
- Long-horizon PRD integrations (voice, mobile, design-to-code, localization)

## Status Snapshot

Completed:

- Phase 0 stream contracts and startup validation are in place
- File operations engine is in place
- Shell sandbox core is in place
- Git inspection core is in place
- Git stage/commit/branch workflows are in place
- Intent router v1 and usage-limit enforcement are in place

Partially complete:

- Phases 3–6 core APIs exist but several exit criteria and client surfaces remain (see phase tickets)
- Routing evals include policy/repository suites with baseline/trend DB storage; SWE-bench-style quality evals via `swe-fixtures` suite with fail-closed CI gate
- Deploy CI includes synthesis rollout gate; routing + quality regression gates are fail-closed

Not started yet:

- Long-horizon PRD integrations (voice, mobile, design-to-code, localization)

## Architecture Tracks

### Track A: Shared Agent Core

- Implement shared orchestration contracts for sessions, actions, diffs, tool calls, approvals, and verification
- Add intent routing tiers:
  - Local Qwen router for classification
  - DeepSeek Flash for simple edits
  - DeepSeek Pro or Pro-Max for complex refactors
  - Claude Sonnet for hard debugging
  - Claude Opus fallback only for frontier tasks
- Add confidence scoring, model escalation, and cost tracking per request
- Add verification stack: static analysis, self-check, retry loop, human confirmation when confidence is low

### Track B: Code Mode Parity

- Terminal TUI with split panes, command palette, keyboard modes, diff preview, streaming, and approvals
- File read, edit, diff, multi-file planning, tree-sitter-aware targeting, and atomic apply
- Shell sandbox with allowlist, timeout, memory caps, streaming output, and blocked dangerous commands
- Git status, diff, log, stage, commit, branch, merge-assist, and worktree support
- Loop workflows:
  - `/loop` fix-until-pass
  - `/compact` summarize context
  - `/ultrareview` deep audit
  - auto mode with risk-based approvals

### Track C: Platform Surfaces

- Web dashboard for chat, analytics, billing, settings, API keys, and session replay
- Desktop app for coding workflow plus native system integrations
- VS Code extension with webview chat, explain/refactor commands, inline diff display, status bar, and problem matcher hooks
- Shared client SDK in `packages/shared` for session, streaming, tool events, billing, and future daemon support

### Track D: Projects and Teams

- Incremental embeddings and RAG context retrieval with Qdrant-compatible abstraction
- Session memory, summaries, project knowledge base, and reusable style/context packs
- Team sharing, permissions, shared context, and session export/share flows
- Memory pruning and summarized long-term history

### Track E: Cowork Mode

- Desktop task runner for non-coding workflows
- File system watcher and download-folder automation
- OCR and structured extraction pipelines
- Screenshot analysis and visual debugging
- Browser automation and computer-use flows via Playwright
- Scheduled tasks, recurring jobs, and notifications
- Plugin surface and curated connectors for India-relevant workflows

### Track F: India Go-To-Market Readiness

- Razorpay-first billing with INR pricing and UPI support
- Student/free-tier guardrails and request-based limits
- India-region hosting assumptions and latency monitoring
- Localization hooks for Hinglish-facing copy and India-specific integrations

## Delivery Phases

## Phase 0: Stabilize Foundations

Goal: turn the current scaffold into a reliable shared platform.

- Replace mock streaming with real orchestration boundaries and typed tool events
- Move API and client payloads toward shared contracts where practical
- Add explicit environment config for model providers, Redis, vector store, and billing providers
- Add smoke validation for API, web, desktop, and terminal startup

Exit criteria:

- One shared session lifecycle works consistently across web, desktop, and terminal
- Streaming format supports token, tool call, diff, approval request, and complete events

## Phase 1: MVP Code Mode

Goal: deliver the cheapest viable Claude Code competitor for solo developers.

- Terminal TUI parity improvements:
  - file tree pane
  - chat pane
  - diff pane
  - keyboard shortcuts and command palette
- File operations engine
- Git integration core
- Shell sandbox core
- Intent router v1 and model escalation policy
- Cost and usage accounting tied to billing tiers
- Free, Lite, and Pro limit enforcement

Exit criteria:

- User can open a project, ask for edits, review diffs, approve changes, run tests, and inspect git state
- Request routing and usage logs show which model path was chosen and why

## Phase 2: Platform Expansion

Goal: ship Code mode across all primary surfaces.

- Web dashboard matures into full admin and session replay surface
- Desktop app gains unified coding layout, updater hooks, and richer project controls
- VS Code extension initial release with chat panel, explain/refactor commands, diffs, and status signals
- Shared package exposes reusable transport and agent client contracts
- Memory, context manager, and MCP v1 land for project-aware workflows

Exit criteria:

- Same session backend supports terminal, desktop, web, and VS Code
- Users can resume project context across surfaces

## Phase 3: Advanced Code Features

Goal: close major feature gaps with Claude Code on developer workflows.

- `/loop`, `/compact`, `/ultrareview`, and auto mode
- Parallel sessions
- Multi-file planning and rollback-aware execution
- Remote control and channel/event streaming
- Artifacts/live preview support for generated apps and diagrams
- Custom agents and reusable task templates

Exit criteria:

- Product can handle multi-step edit, verify, and retry loops with explicit confidence and rollback behavior

## Phase 4: Cowork Mode

Goal: expand from coding assistant to desktop automation agent.

- Cowork desktop workspace and task planner
- File watcher and routine automation
- OCR/data extraction pipelines
- Screenshot analysis, computer use, and browser automation
- Scheduled tasks and reminders
- Plugin or connector execution boundary

Exit criteria:

- Desktop app can perform repeatable non-coding workflows safely with preview and verification

## Phase 5: Projects and Team Platform

Goal: support shared work across startups and teams.

- Shared project knowledge base and uploads
- Team context, permissions, and real-time updates
- Session sharing/export
- Shared style guides and team learnings
- Agent teams/orchestrator flows for delegated tasks
- Enterprise controls: SSO, dynamic rate limits, auditability

Exit criteria:

- Team plan has distinct value beyond solo plans and can support collaborative usage safely

## Phase 6: Quality, Trust, and Frontier Routing

Goal: approach Claude-level outcomes without Claude-level cost.

- DeepSeek-first default paths for the majority of requests
- Sonnet fallback for hard debugging
- Opus fallback only for frontier tasks and enterprise workloads
- Multi-model verification where needed
- Honest confidence messaging in UI when output confidence is weak
- Benchmarking against SWE-bench-style internal eval sets and real repository tasks

Exit criteria:

- Product quality messaging and routing policy are evidence-backed, cost-bounded, and observable

## 12-Week Working Roadmap

### Weeks 1-2

- Stabilize shared session contracts and streaming events
- Finish terminal layout parity and command system
- Implement real file operations and git core
- Wire real model routing configuration and usage accounting

### Weeks 3-5

- Deliver shell sandbox, context manager, memory, MCP, and loop workflows
- Expand desktop from scaffold to coding workspace
- Ship VS Code extension MVP
- Complete web analytics, billing, settings, and session replay improvements

### Weeks 6-8

- Build cowork mode foundations: watcher, OCR, screenshot analysis, browser automation, scheduling
- Add artifacts/live preview and design-to-code groundwork
- Add Google Workspace and India-relevant integration hooks where feasible

### Weeks 9-12

- Add team sharing, permissions, shared context, and agent teams
- Add enterprise controls, SSO, rate policies, and export/audit flows
- Run scale, reliability, and eval passes before broader launch

## Feature Coverage Reference

The plan now explicitly covers the feature families described in the source strategy document:

- Chat mode
- Cowork mode
- Code mode
- Projects mode
- Terminal TUI
- Desktop app
- VS Code extension
- File read/edit/diff
- Shell sandbox
- Git integration
- Multi-file edits
- Loop workflows
- Context summarization
- Deep audit workflows
- Auto mode
- Parallel sessions
- Git worktrees
- Team orchestration
- Project knowledge base
- RAG context retrieval
- Team sharing
- Session sharing
- Shared context
- Remote control
- Event channels
- MCP connectors
- Cross-session memory
- Computer use
- Voice control
- Design-to-code
- Visual debugging
- Google Workspace integrations
- Office add-ins or equivalent document flows
- Custom agents
- Skills/eval system
- Artifacts/live preview
- Charts and diagrams
- Contextual guardrails
- Programmatic rate limits

## Immediate Next Build Order

Given the current repo state, the next implementation slices should be:

1. Surface parity: confidence UI on desktop Code + VS Code; team/cowork tabs or commands on desktop/terminal
2. ~~Web chat Run Loop UI~~ (shipped in Advanced Workflows panel)
3. ~~ECS worker deploy for cowork scheduled jobs + move `_worker_loop` off API process~~ (Celery beat tick in worker; API gated by `CODEFORGE_COWORK_SCHEDULER_ENABLED`)
4. ~~SWE-bench-style internal eval harness (patch apply + verify), with fail-closed CI regression on quality drops~~
5. ~~Enterprise foundations: audit log table + share/member/delegation events; knowledge file upload API~~
6. ~~Phase 3 stretch picks: artifacts preview, terminal fork/auto mode, custom agent templates~~ (shipped)

## Ticket Backlog

The build queue that implements this plan lives in [docs/tickets/README.md](docs/tickets/README.md).

Recommended ticket order:

1. [Phase 0 - Foundation](docs/tickets/phase-0-foundation.md)
2. [Phase 1 - Code Mode Core](docs/tickets/phase-1-code-mode.md)
3. [Phase 1 - Terminal Parity](docs/tickets/phase-1-terminal.md)
4. [Phase 2 - Platform Surfaces](docs/tickets/phase-2-platform-surface.md)
5. [Phase 3 - Advanced Code Features](docs/tickets/phase-3-advanced-code.md)
6. [Phase 4 - Cowork Mode](docs/tickets/phase-4-cowork.md)
7. [Phase 5 - Projects and Team Platform](docs/tickets/phase-5-projects-team.md)
8. [Phase 6 - Quality and Routing](docs/tickets/phase-6-quality-routing.md)

## What Is Done vs Left

Done:

- Phase 0 foundation: shared stream events, session contracts, environment config surface, and smoke validation
- Phase 1 code mode core: file operations, git integration, shell sandbox, intent routing, and usage enforcement
- Phase 1 terminal parity: split panes, palette/modes, and approval display
- Phase 2 platform surfaces: web, desktop, VS Code, and shared client surfaces
- Phase 3 advanced code features: looped verify/fix workflow, compact summaries, ultrareview audits, and multi-file plan/rollback execution
- Phase 4 cowork mode: task planning/runs, watchers/scheduled jobs, extraction history, and explicit browser-task approval
- Phase 5 projects/team platform: project knowledge base, workspace sharing/roles, session share/export, and delegation records
- Session lifecycle, message persistence, SSE streaming, billing foundations, file ops, git inspection, and shell sandboxing
- Shared client helpers for file, git, and shell surfaces
- Terminal file tree, chat, diff/review, and activity panes
- Terminal command support for `/git`, `/run`, `/mode`, `/approve`, `/reject`, `/compact`, `/ultrareview`, `/plan`, `/rollback`, and `/loop`
- VS Code extension manifest, backend-backed panel, inline diff preview, live editor-context sync, status bar actions, editor title actions, and explain/refactor/review command entry points

Left:

- Production IdP rollout and ECS SSM secret wiring
- Replace placeholder EFS filesystem IDs for cloud workspace mounts
- MCP remote transport and billing-tier org modeling

## Non-Goals For The Near Term

- Do not try to ship all 38 features before the code-mode core is reliable
- Do not lead with enterprise-only features before solo developer workflows are strong
- Do not over-index on frontier models before routing, caching, and verification are measurable
