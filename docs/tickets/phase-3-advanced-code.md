# Phase 3 - Advanced Code Features

## Goal

Close the workflow gaps with Claude Code-style looped execution and higher-order orchestration.

## Status

- T3.1 /loop workflow: **done (terminal, desktop, VS Code, web)** — backend `/agent/loop` with verify/fix UI on all coding surfaces
- T3.2 /compact context summary: **done (terminal, desktop, VS Code, web)** — backend compact workflow + terminal local summary
- T3.3 /ultrareview deep audit: **done (terminal, desktop, VS Code, web)** — backend ultrareview + terminal local audit
- T3.4 multi-file planning and rollback: **done (terminal, desktop, VS Code, web)** — backend plan/execute/rollback APIs

- T3.5 session fork / parallel sessions: **done (terminal, desktop, web)** — `POST /sessions/{id}/fork`, `/fork` command, Fork button in Advanced Workflows
- T3.6 auto mode on plan execution: **done (terminal, desktop, web)** — auto-approves plan steps when enabled; `/auto on|off|toggle` on terminal
- T3.7 artifacts / live preview: **done (API, terminal, web, desktop)** — fenced `html`/`markdown`/`mermaid` extraction, list + preview endpoints, iframe preview in web/desktop
- T3.8 custom agent templates: **done (API, terminal, web, desktop)** — CRUD templates, compose prefix, optional `template_id` on message send

- T3.9 remote control / event channels: **done (API + terminal)** — `POST/GET /api/v1/remote/channels`, pair via code, SSE `/remote/channels/{id}/events`, push events; terminal `/team remote ...`

## Tickets

### T3.1 - `/loop` workflow

- Run edit/verify/fix cycles until the test loop passes or a limit is reached.
- Keep rollback behavior explicit.
- Current state: `/loop --verify <command> [--max <n>] [--prompt <text>]` runs bounded attempts, verifies via shell stream, triggers fix turns, and applies returned proposals.
- Acceptance: a loop workflow can make repeated fixes with bounded retries.

### T3.2 - `/compact` context summary

- Summarize session and project context into a compact continuation prompt.
- Preserve the most useful state while trimming noise.
- Current state: the terminal can now emit a compact continuation summary from the active session, diff, shell, and event state.
- Acceptance: a long session can be compressed and resumed.

### T3.3 - `/ultrareview` deep audit

- Build a deeper review flow for code quality and risk inspection.
- Show findings before applying changes.
- Current state: the terminal can now generate a local ultrareview audit with findings and suggested checks before any file write.
- Acceptance: the user can request a deeper audit workflow.

### T3.4 - Multi-file planning and rollback

- Plan related changes across multiple files.
- Apply atomically when possible.
- Current state: `/plan <files...>` snapshots grouped targets, `/plan run <prompt>` executes grouped edits with rollback-on-failure semantics, and `/rollback` restores the captured snapshot explicitly.
- Acceptance: the agent can preview and execute a grouped change set.
