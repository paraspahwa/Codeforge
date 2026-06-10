# Phase 5 - Projects and Team Platform

## Goal

Support shared work, knowledge, and collaboration for teams.

## Status

- T5.1 project knowledge base: **done** — DB-backed index rebuild/query/upload, vector merge, auto-inject into agent stream
- T5.2 team sharing and permissions: **partial** — DB-backed workspaces with owner/admin/member/viewer roles; web `/team` UI; audit log for share/member/delegation/knowledge events; **session-level access enforcement** via `services/api/app/session_access.py` (workspace membership alone does not expose another member's private session); **no SSO** on team surfaces yet
- T5.3 session export/share: **done (API + web + desktop + terminal + VS Code)** — markdown/json export, share links (`/share/[id]`); optional `workspace_id` query param on export for team-context resolution
- T5.4 team orchestration flows: **partial** — DB-backed delegations with `POST .../delegations/{id}/execute` (single-agent run with role prefix); not multi-agent orchestration

- Team UI: **done (web, desktop Team mode, terminal `/team`, VS Code Team tab)** — workspaces, members, delegations, audit, share/export, knowledge upload/query
- Real-time team updates: **done** — `GET /api/v1/team/events` SSE; subscribers on web `/team`, desktop Team, VS Code panel
- T5.5 shared style guides: **done** — workspace-scoped `team_style_guides`, CRUD API, compose into session stream + delegations
- T5.6 multi-agent delegation orchestration: **done** — `sequential` / `supervisor` modes, per-step outputs, agent template role mapping
- **Still open:** client OIDC login UX; approval gates between delegation steps

## Tickets

### T5.1 - Project knowledge base

- Add project-scoped memory, summaries, and retrieval.
- Support reusable context packs and style guidance.
- Current state: project knowledge rebuild/query endpoints index workspace files and provide consistent retrieval snippets for active sessions.
- Acceptance: a session can pull in project context consistently.

### T5.2 - Team sharing and permissions

- Add shared workspaces, roles, and access controls.
- Keep session sharing explicit and auditable.
- Current state: workspace membership supports owner/admin/member/viewer style role control with explicit member add flows. Session access is resolved in `session_access.py`:
  - **Owned sessions** — always visible to the owner.
  - **Workspace owner sessions** — visible to workspace members when `workspace_id` is supplied (or inferred from a session grant).
  - **Granted sessions** — `POST /api/v1/team/workspaces/{id}/session-grants` with `view` or `delegate` access levels.
  - **Active share links** — members can resolve sessions shared by any workspace member.
  - **Denied by default** — a workspace member cannot export, delegate, or execute against another member's private session without a grant or share (returns 404/403).
- Acceptance: a team can collaborate on the same project context safely.

### T5.3 - Session export/share

- Add export flows for markdown, JSON, and replay links.
- Support handoff between teammates or surfaces.
- Current state: session-share links include expiry/access level. Session export:
  - `GET /api/v1/team/session-export/{session_id}?format=json|markdown`
  - Optional `workspace_id` — scopes team-context resolution (required when exporting a session you access only via workspace grant, not ownership).
  - Shared client: `exportSession(baseUrl, token, sessionId, format, workspaceId)` in `@codeforge/shared/api`.
- Acceptance: a session can be shared or resumed elsewhere.

### T5.4 - Team orchestration flows

- Add delegated task patterns for teams and agent groups.
- Keep approval and traceability strong.
- Current state: delegation endpoints capture assigned role, requester, priority, and traceable queued status for team-level routing workflows. `POST /api/v1/team/delegations` rejects foreign member sessions (403). `POST .../delegations/{id}/execute` requires the actor to resolve the backing session via `resolve_team_session` (404 when another member's private session).
- Acceptance: team-level workflows can route work to specific agents or roles.
