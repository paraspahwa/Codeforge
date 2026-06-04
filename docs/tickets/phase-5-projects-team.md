# Phase 5 - Projects and Team Platform

## Goal

Support shared work, knowledge, and collaboration for teams.

## Status

- T5.1 project knowledge base: done, API now rebuilds/query project-scoped knowledge indexes with consistent retrieval snippets per session
- T5.2 team sharing and permissions: done, shared workspaces and role-based member management are implemented via explicit owner/admin controls
- T5.3 session export/share: done, session share links and markdown/json export endpoints support cross-surface handoff and resume flows
- T5.4 team orchestration flows: done, delegation APIs route tasks to named team roles with traceable queued records

## Tickets

### T5.1 - Project knowledge base

- Add project-scoped memory, summaries, and retrieval.
- Support reusable context packs and style guidance.
- Current state: project knowledge rebuild/query endpoints index workspace files and provide consistent retrieval snippets for active sessions.
- Acceptance: a session can pull in project context consistently.

### T5.2 - Team sharing and permissions

- Add shared workspaces, roles, and access controls.
- Keep session sharing explicit and auditable.
- Current state: workspace membership supports owner/admin/member/viewer style role control with explicit member add flows.
- Acceptance: a team can collaborate on the same project context safely.

### T5.3 - Session export/share

- Add export flows for markdown, JSON, and replay links.
- Support handoff between teammates or surfaces.
- Current state: session-share links include expiry/access level and session-export endpoints support markdown/json content export.
- Acceptance: a session can be shared or resumed elsewhere.

### T5.4 - Team orchestration flows

- Add delegated task patterns for teams and agent groups.
- Keep approval and traceability strong.
- Current state: delegation endpoints capture assigned role, requester, priority, and traceable queued status for team-level routing workflows.
- Acceptance: team-level workflows can route work to specific agents or roles.
