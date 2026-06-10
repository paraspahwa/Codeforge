# @codeforge/shared

Cross-surface client SDK for the CodeForge API. Used by web, desktop, and terminal apps. Each subpath is a separate export — import only what you need.

## Subpath exports

| Import | Module | Purpose |
| --- | --- | --- |
| `@codeforge/shared/api` | `src/api.js` | REST helpers for all `/api/v1/*` endpoints |
| `@codeforge/shared/agent` | `src/agentClient.js` | Chat turn orchestration, SSE session streams, workflow runners |
| `@codeforge/shared/sse` | `src/sse.js` | Routing-signal parsing and SSE event formatting |
| `@codeforge/shared/sessions` | `src/sessions.js` | Team session-grant access helpers |

## API client (`/api`)

All functions take `(baseUrl, token, ...)` unless noted. Base URL defaults to `process.env.CODEFORGE_API_BASE_URL` or `http://127.0.0.1:8000`.

### Sessions and chat

- `devLogin`, `listSessions`, `createSession`, `listMessages`, `sendMessage`
- `streamSessionEvents` (async generator over SSE)
- `listProposals`, `getProposal`, `decideProposal`
- `runAgentLoop`, `forkSession`

### Code workflows

- `compactWorkflow`, `ultrareviewWorkflow`
- `createWorkflowPlan`, `executeWorkflowPlan`, `rollbackWorkflowPlan`
- `getFilePreview`, `getFileContent`, `applyFile`
- `streamShellCommand` (async generator)

### Git

- `getGitStatus`, `getGitDiff`, `getGitLog`, `stageGitFiles`, `commitGitChanges`
- `branchGitRepo`, `listGitWorktrees`, `createGitWorktree`
- `getGitMergeAssist`, `getGitConflictGuide`, `applyGitConflictAssist`

### Artifacts and templates

- `listSessionArtifacts`, `getSessionArtifact`, `sessionArtifactPreviewUrl`
- `createAgentTemplate`, `listAgentTemplates`, `deleteAgentTemplate`, `composeAgentTemplate`

### Cowork, team, orgs

- Cowork: `createCoworkPlan`, `listCoworkPlans`, `runCoworkPlan`, `listCoworkRuns`, jobs/extractions
- Team: workspaces, delegations, audit log, style guides, `streamTeamEvents`
- Orgs: `createOrganization`, `listOrganizations`, billing linkage, session grants

### Platform

- OIDC: `getOidcConfig`, `getOidcAuthorizeUrl`, `completeOidcCallback`, `exchangeOidcToken`
- Billing: plans, orders, verify, subscription, `getBillingContext`
- MCP connectors, context packs, remote channels, usage/analytics benchmarks

Web apps typically wrap these in `apps/web/lib/api.js` with a fixed `NEXT_PUBLIC_API_BASE`. Desktop and terminal call the shared module directly with `CODEFORGE_API_BASE_URL`.

## Agent client (`/agent`)

Higher-level chat and workflow helpers:

```js
import { runChatTurn, createSessionStream, buildMessageContext } from "@codeforge/shared/agent";

const context = buildMessageContext({
  workspacePath: "/path/to/repo",
  activeFile: "src/main.py",
  selection: "def foo():",
});

for await (const event of runChatTurn(baseUrl, token, sessionId, { content: "Fix tests", context })) {
  if (event.type === "route") { /* routing signal */ }
  if (event.type === "token") { /* stream chunk */ }
  if (event.type === "complete") break;
}
```

- `runChatTurn`: POST message then consume SSE until `complete`
- `createSessionStream`: long-lived SSE subscription with abort handle
- Workflow runners delegate to `/api` plan and loop endpoints

## SSE helpers (`/sse`)

Parse routing metadata from API responses and format activity feed lines:

```js
import { routingSignalFromMessageResponse, formatRoutingSignal, formatEvent } from "@codeforge/shared/sse";

const signal = routingSignalFromMessageResponse(sendResponse);
// { intent, model_used, confidence_score, confidence_label, review_required, routing_tier, fallback_used }

console.log(formatRoutingSignal(signal));
// "Routing: code_edit via deepseek-v4 · confidence high 92% · tier pro"
```

`formatEvent` maps SSE `type` values (`token`, `tool_call`, `diff`, `shell_output`, etc.) to compact log strings for terminal and desktop activity panes.

## Session grants (`/sessions`)

Team workspaces can grant view-only or delegate access to another member's session:

```js
import { canWriteSession, isViewOnlySession, viewOnlySessionMessage } from "@codeforge/shared/sessions";

if (!canWriteSession(currentSession)) {
  // disable composer, loop, proposals
}
```

- Owned sessions (`access_source !== "granted"`): full write access
- Granted `view`: read-only; `delegate`: write allowed

## Environment

| Variable | Used by | Default |
| --- | --- | --- |
| `CODEFORGE_API_BASE_URL` | Node/desktop/terminal | `http://127.0.0.1:8000` |
| `NEXT_PUBLIC_API_BASE` | Web (via `apps/web/lib/api.js`) | `http://localhost:8000` |
