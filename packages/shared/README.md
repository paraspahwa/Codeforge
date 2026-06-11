# Shared Package

Browser and Node client SDK used by web, desktop, and terminal apps. Entry point: `packages/shared/src/api.js`.

## Core helpers

| Area | Functions |
|------|-----------|
| Auth | `devLogin`, `exchangeOidcCode`, `getOidcConfig`, `getOidcAuthorizeUrl` |
| Sessions | `createSession`, `listSessions`, `forkSession`, `sendMessage`, `streamSession` |
| Files / git / shell | `previewFile`, `applyFile`, `getGitStatus`, `streamShell` |
| Team / cowork | `listCoworkPlans`, `runCoworkPlan`, `scrapeCoworkData`, team workspace APIs |
| Billing | `getBillingPlans`, `getBillingContext`, `createBillingOrder`, `verifyPayment` |

## Phases 7–10 helpers

Added for taste, skills, RTK, memory, and Supermemory surfaces:

```javascript
import {
  getTasteRules,
  getTasteStats,
  exportTaste,
  importTaste,
  listSkills,
  getAgentPreferences,
  updateAgentPreferences,
  getRtkStatus,
  listMemories,
  searchMemory,
  saveMemory,
  exportMemory,
  getSupermemoryStatus,
  searchSupermemory,
  saveSupermemory,
  scrapeCoworkData,
} from "@codeforge/shared";
```

All functions take `(baseUrl, token, ...)` and return parsed JSON from the matching `/api/v1/*` route. See [docs/phases-7-10-developer-guide.md](../../docs/phases-7-10-developer-guide.md) for API semantics.

## SSE streaming

`streamSession(baseUrl, sessionId, token)` yields parsed SSE JSON events from `GET /api/v1/sessions/{id}/stream`. Used by chat surfaces across web, desktop, and terminal.
