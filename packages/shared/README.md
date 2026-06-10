# @codeforge/shared

Cross-client JavaScript helpers for the CodeForge API. Used by web (via thin wrappers), desktop, and the Ink terminal.

## Modules

| Import path | File | Purpose |
| --- | --- | --- |
| `@codeforge/shared/api` | `src/api.js` | REST client for sessions, git, workflows, billing, team, cowork, MCP, OIDC |
| `@codeforge/shared/sse` | `src/sse.js` | SSE event formatting and routing-signal parsing |
| `@codeforge/shared/sessions` | `src/sessions.js` | Workspace session-grant read/write semantics |
| `@codeforge/shared/agent` | `src/agentClient.js` | Agent-loop client utilities |

All `api` functions take `(baseUrl, token, …)` as the first arguments. Default base URL: `process.env.CODEFORGE_API_BASE_URL` or `http://127.0.0.1:8000`.

## API client (`@codeforge/shared/api`)

Grouped surface area:

- **Auth**: `devLogin`, OIDC (`getOidcConfig`, `getOidcAuthorizeUrl`, `completeOidcCallback`, …)
- **Sessions**: `listSessions`, `createSession`, `listMessages`, `sendMessage`, `forkSession`
- **Proposals**: `listProposals`, `getProposal`, `decideProposal`
- **Code/git**: `getFilePreview`, `getGitStatus`, `getGitDiff`, `getGitConflictGuide`, `applyGitConflictAssist`, …
- **Workflows**: `runAgentLoop`, `compactWorkflow`, `ultrareviewWorkflow`, `createWorkflowPlan`, `executeWorkflowPlan`, `rollbackWorkflowPlan`
- **Artifacts/templates**: `listSessionArtifacts`, `createAgentTemplate`, `listAgentTemplates`
- **Streaming**: `streamSessionEvents`, `streamShellCommand`, `streamTeamEvents` (async generators)
- **Usage/analytics**: `getUsageSummary`, routing and quality benchmark endpoints
- **Cowork**: plans, runs, jobs, extractions
- **Team**: workspaces, delegations, audit log, style guides, session grants
- **Orgs/billing**: organizations, `getBillingContext`, checkout helpers
- **Context/MCP**: context packs, MCP connector registry and invocation

Web app re-exports these through `apps/web/lib/api.js` with a fixed `NEXT_PUBLIC_API_BASE`. Desktop does the same in `apps/desktop/src/api.js`.

### Streaming example

```js
import { streamSessionEvents } from "@codeforge/shared/api";

for await (const event of streamSessionEvents(baseUrl, token, sessionId)) {
  // event.type: token | tool_call | diff | proposal | done | ...
}
```

## SSE helpers (`@codeforge/shared/sse`)

- `routingSignalFromPayload` / `routingSignalFromMessageResponse` — normalize routing metadata from API responses
- `formatRoutingSignal(signal)` — human-readable banner string for terminal/desktop/web
- `formatEvent(event)` — compact activity-feed line for agent events

## Session grants (`@codeforge/shared/sessions`)

When a workspace member receives delegated access to another user's session, list entries include grant metadata.

```js
import {
  canWriteSession,
  isViewOnlySession,
  formatSessionListLabel,
  viewOnlySessionMessage,
} from "@codeforge/shared/sessions";

if (!canWriteSession(currentSession)) {
  // disable send, loop, proposals
}
```

| Field | Meaning |
| --- | --- |
| `access_source` | `"granted"` when access comes from a workspace session grant |
| `access_level` | `"view"` (read-only) or `"delegate"` (read + write) |
| `owner_user_id` | Original session owner |

**VS Code note:** The extension webview duplicates these helpers in `apps/vscode/media/sessions-helpers.js`. Keep both in sync when changing grant rules.

## Environment

| Variable | Used by |
| --- | --- |
| `CODEFORGE_API_BASE_URL` | Node/desktop/terminal default API base |

Browser clients set base URL in app-specific config (`NEXT_PUBLIC_API_BASE`, `VITE_CODEFORGE_API_BASE_URL`).
