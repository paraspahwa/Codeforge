# CodeForge PRD

## Product Requirements Document

### Version: 1.1 | Date: June 2026 | Target: India Market

## 1. Product Summary

CodeForge is an India-first Claude Code alternative built on one shared backend with four user modes:

- Chat for web and mobile-friendly assistant usage
- Code for terminal, desktop, and VS Code coding workflows
- Cowork for desktop automation and non-coding tasks
- Projects for shared memory, RAG, session history, and team context

## 2. Positioning

- Lite: INR 199
- Pro: INR 499
- Team: INR 1299
- Enterprise: custom pricing with frontier-model fallback

The goal is to stay meaningfully cheaper than Claude Code while preserving the workflows developers care about most: fast responses, file diffs, approvals, command execution, and project context.

## 3. Product Vision

"The AI coding assistant that every Indian developer can afford, without giving up power or trust."

### Value Proposition

- For freshers: learn faster with AI pair programming at a price that fits a student or first job salary.
- For professionals: ship code faster with lower model costs and clearer approvals.
- For teams: share context, review changes, and keep standards aligned.

## 4. Implementation Alignment

The execution order for this PRD is defined in [docs/implementation-plan.md](docs/implementation-plan.md). The current roadmap is:

1. Stabilize shared contracts and streaming events.
2. Ship MVP Code mode core.
3. Expand the same backend across web, desktop, and VS Code.
4. Add advanced loops and orchestration.
5. Build Cowork automation.
6. Add Projects and team collaboration.
7. Improve routing quality, trust, and evaluation.

### Runtime Assumptions

- Backend API uses Python 3.13 and the documented local environment variables for database, auth, billing, and tracing.
- Terminal uses `CODEFORGE_API_BASE_URL`, `CODEFORGE_USER_ID`, and `CODEFORGE_MODEL` when local defaults are needed.
- Web and desktop connect to the same backend URL and session lifecycle as the terminal.

## 5. Feature Scope

### 5.1 Shared Agent Core

- Typed session, action, diff, tool, approval, and verification events
- Intent routing tiers with DeepSeek-first defaults and Claude fallback
- Confidence scoring and model escalation
- Usage, latency, and cost accounting per request
- Verification loop for risky or low-confidence changes

### 5.2 Code Mode Parity

- Split-pane terminal UI
- File read, edit, and diff flow
- Atomic apply after approval
- Shell sandbox with allowlist and timeouts
- Git status, diff, log, stage, commit, and branch support
- Loop workflows such as `/loop`, `/compact`, and `/ultrareview`

### 5.3 Platform Surfaces

- Web dashboard for chat, analytics, billing, and session replay
- Desktop app for coding workflows and native integrations
- VS Code extension with chat, refactor, explain, and diff features
- Shared client SDK for sessions, streaming, billing, and future daemon support

### 5.4 Projects and Teams

- Session memory and summaries
- Project knowledge base and retrieval
- Shared context packs and style guidance
- Team sharing, permissions, and session export

### 5.5 Cowork Mode

- Desktop automation tasks
- Watchers and scheduled jobs
- OCR and structured extraction
- Screenshot analysis and browser automation
- Plugin/connectors for India-relevant workflows

### 5.6 India Go-To-Market Readiness

- Razorpay-first billing with INR pricing and UPI support
- Student and free-tier guardrails
- India-region hosting assumptions and latency awareness
- Hinglish/localization hooks for UI copy

## 6. Delivery Phases

### Phase 0: Stabilize Foundations

Goal: make the scaffold reliable and observable.

- Replace mock streaming with real orchestration boundaries
- Add explicit environment config for providers and storage
- Keep shared contracts consistent across clients
- Add startup smoke checks for API, web, desktop, and terminal

Exit criteria:

- One shared session lifecycle works across web, desktop, and terminal
- Streaming supports token, tool call, diff, approval request, and complete events

### Phase 1: MVP Code Mode

Goal: deliver the cheapest viable Claude Code competitor.

- File operations engine
- Git integration core
- Shell sandbox core
- Terminal TUI parity improvements
- Intent router and usage accounting
- Free, Lite, and Pro limit enforcement

Exit criteria:

- A user can open a project, ask for edits, review diffs, approve changes, run tests, and inspect git state

### Phase 2: Platform Expansion

Goal: support the same core across all surfaces.

- Web admin and session replay
- Desktop coding workspace improvements
- VS Code extension MVP
- Shared client SDK hardening
- Memory and MCP groundwork

Exit criteria:

- Terminal, desktop, web, and VS Code all share the same backend session model

### Phase 3: Advanced Code Features

Goal: close the major workflow gaps.

- `/loop`, `/compact`, `/ultrareview`, and auto mode
- Multi-file planning and rollback-aware execution
- Remote control and channel/event streaming
- Artifacts/live preview support

### Phase 4: Cowork Mode

Goal: expand into desktop automation.

- Cowork task runner
- File watchers and scheduled tasks
- OCR, screenshot analysis, and browser automation
- Notifications and plugin boundaries

### Phase 5: Projects and Team Platform

Goal: support shared work for startups and teams.

- Project knowledge base and uploads
- Team sharing and permissions
- Session export/share
- Agent/team orchestration flows

### Phase 6: Quality, Trust, and Frontier Routing

Goal: keep quality high without pushing cost too high.

- DeepSeek-first default paths
- Sonnet fallback for hard debugging
- Opus fallback for frontier tasks
- Honest confidence messaging and evaluation loops

## 7. Success Metrics

- First token latency under 2 seconds
- Intent routing under 100 ms for local classification
- Stable streaming across all clients
- Lower average request cost than a Claude-only baseline
- Growing retained usage for solo and team workflows

## 8. Notes For Implementation

- Keep the shared backend as the source of truth.
- Prefer small, testable slices over large rewrites.
- Treat approval-before-apply as the default for risky file changes.
- Use the implementation plan and tickets for the build order.
