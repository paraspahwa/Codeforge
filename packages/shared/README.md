# @codeforge/shared

Shared JavaScript client SDK for CodeForge surfaces (web, desktop, terminal, VS Code). All HTTP calls target the FastAPI backend under `/api/v1/*`.

## Install

The package is a workspace dependency. From the repo root:

```bash
npm install
```

Import by subpath (ESM):

```javascript
import { createSession, sendMessage } from "@codeforge/shared/api";
import { runChatTurn } from "@codeforge/shared/agent";
import { formatRoutingSignal } from "@codeforge/shared/sse";
```

## Modules

| Export path | File | Purpose |
|-------------|------|---------|
| `@codeforge/shared/api` | `src/api.js` | Typed HTTP helpers for every backend route |
| `@codeforge/shared/agent` | `src/agentClient.js` | High-level chat turn + workflow helpers |
| `@codeforge/shared/sse` | `src/sse.js` | SSE event formatting and routing signal helpers |
| `@codeforge/shared/sessions` | `src/sessions.js` | Session list/create utilities |

## Configuration

Clients read `CODEFORGE_API_BASE_URL` (default `http://127.0.0.1:8000`). The web app uses `NEXT_PUBLIC_API_BASE`; the desktop app uses `VITE_CODEFORGE_API_BASE_URL`.

Every authenticated call passes `token` as a Bearer JWT obtained from dev-login or OIDC exchange.

## API surface (`api.js`)

Grouped by domain. All functions take `(baseUrl, token, ...)` unless noted.

**Sessions & streaming**

- `createSession`, `listSessions`, `forkSession`, `listMessages`, `sendMessage`
- `streamSessionEvents` (async generator), `decideProposal`, `runAgentLoop`

**Code mode**

- File: `getFilePreview`, `getFileContent`, `applyFile`
- Git: `getGitStatus`, `getGitDiff`, `getGitLog`, `stageGitFiles`, `commitGitChanges`, conflict assist
- Shell: `streamShellCommand` (async generator over SSE chunks)

**Workflows**

- `compactWorkflow`, `ultrareviewWorkflow`, `createWorkflowPlan`, `executeWorkflowPlan`, `rollbackWorkflowPlan`

**Agent personalization (Phases 7–8)**

- Taste: `getTasteRules`, `getTasteStats`, `exportTaste`, `importTaste`
- Skills: `listSkills`, `getAgentPreferences`, `updateAgentPreferences`
- RTK: `getRtkStatus`
- Memory: `listMemories`, `searchMemory`, `saveMemory`, `exportMemory`
- Supermemory: `getSupermemoryStatus`, `searchSupermemory`, `saveSupermemory`

**Cowork & scrape**

- `createCoworkPlan`, `runCoworkPlan`, `scrapeCoworkData`, `extractCoworkData`, job/plan list helpers

**Team & projects**

- Workspaces, delegations, style guides, session shares, knowledge upload/query, org billing

**Platform**

- Auth/OIDC, billing, MCP connectors, context packs, remote channels, eval benchmarks

## Agent helpers (`agentClient.js`)

```javascript
import { runChatTurn } from "@codeforge/shared/agent";

for await (const event of runChatTurn(baseUrl, token, sessionId, {
  content: "Explain this function",
  context: { workspace_path: "/path/to/repo", active_file: "src/foo.ts" },
})) {
  console.log(event.type, event.payload);
}
```

Also exports workflow runners (`runCompact`, `runUltrareview`, `runPlanExecute`) and `createSessionStream` for long-lived SSE subscriptions.

## SSE helpers (`sse.js`)

Use `routingSignalFromMessageResponse` after `sendMessage` to display confidence/tier in terminal and desktop UIs. `formatEvent` produces human-readable log lines for activity panes.

## Web parity note

The Next.js app duplicates some helpers in `apps/web/lib/api.js` for browser-specific concerns (FormData uploads, settings page). New endpoints should be added to `packages/shared/src/api.js` first, then re-exported or mirrored in the web layer.

## Related docs

- [API backend README](../../services/api/README.md)
- [Phase tickets](../../docs/tickets/README.md)
