# Phase 1 - Code Mode Core

## Goal

Deliver the cheapest viable Claude Code competitor for solo developers.

## Status

- T1.1 file operations engine: done
- T1.2 git integration core: done, status/diff/log plus stage/commit/branch/worktree/merge-assist workflows are present with staged-only commit safety, conflict blocking, and merge risk recommendations
- T1.3 shell sandbox core: done
- T1.4 intent router and model policy: done, routing decisions now include intent, model, and reason
- T1.5 usage and limit enforcement: done, plan-aware request caps are enforced in the backend

## Tickets

### T1.1 - File operations engine

- Implement safe file read, excerpt, diff preview, and atomic apply helpers.
- Support approval-before-apply for risky changes.
- Acceptance: a proposal can preview and apply a single-file change safely.

### T1.2 - Git integration core

- Implement git status, diff, log, stage, commit, branch, worktree, and merge-assist workflows.
- Keep commit generation and review approval explicit.
- Current state: commit now requires staged files and rejects unresolved conflicts; merge-assist exposes risk level, auto-merge recommendation, conflict-file hints, and safety recommendations; conflict-guide endpoint and terminal `/git resolve-guide <branch>` provide guided resolution steps.
- Acceptance: the agent can inspect repo state and prepare git actions.

### T1.3 - Shell sandbox core

- Add allowlisted command execution with timeout and blocking rules.
- Stream shell output back through the shared event model.
- Acceptance: safe commands run and dangerous commands are blocked.

### T1.4 - Intent router and model policy

- Define local classification and model escalation rules.
- Record why a request routed to a given model.
- Acceptance: requests show intent, chosen model, and estimated cost.

### T1.5 - Usage and limit enforcement

- Track request usage against Lite, Pro, and Team tiers.
- Apply request limits consistently across clients.
- Acceptance: the usage summary and plan enforcement use the same backend data.
