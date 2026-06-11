# Shared Package

Browser and Node.js client SDK used by web, desktop, terminal, and VS Code surfaces.

## Entry point

`packages/shared/src/api.js` — HTTP helpers, SSE streaming, and typed request wrappers for the CodeForge API.

## Core surfaces

| Area | Key exports |
|------|-------------|
| Auth | `devLogin`, OIDC helpers |
| Sessions | `createSession`, `listSessions`, `streamSession` |
| File / git / shell | `readFile`, `gitStatus`, `runShell`, proposal apply/reject |
| Team / cowork | workspace, knowledge, delegation, scrape helpers |
| Billing | `getBillingContext`, `createBillingOrder`, subscription helpers |
| Context / MCP | context pack attach/compose, connector registry |

## Agent extensions (phases 7–10)

| Area | Key exports |
|------|-------------|
| Taste | `getTasteRules`, `getTasteStats`, `exportTaste`, `importTaste` |
| Skills | `listSkills`, `getAgentPreferences`, `updateAgentPreferences` |
| RTK | `getRtkStatus` |
| Memory | `listMemories`, `searchMemory`, `saveMemory`, `exportMemory` |
| Supermemory | `getSupermemoryStatus`, `searchSupermemory`, `saveSupermemory` |
| Scrape | `scrapeCoworkData` |

All helpers accept `(baseUrl, token, ...)` and use `requestJson` with Bearer auth.

## SSE streaming

`streamSseJson` parses `text/event-stream` responses into async iterables. Used by `streamSession` and workflow endpoints.

## Usage

```javascript
import { devLogin, getTasteStats, updateAgentPreferences } from "@codeforge/shared";

const { access_token } = await devLogin(baseUrl, "dev-user");
const stats = await getTasteStats(baseUrl, access_token);
```

See [docs/agent-extensions.md](../../docs/agent-extensions.md) for API semantics and env configuration.
