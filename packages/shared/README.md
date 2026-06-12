# @codeforge/shared

Cross-client JavaScript helpers for CodeForge terminal, desktop, VS Code, and any Node-based tooling. Browser web app uses its own `apps/web/lib/api.js` but imports session and SSE modules from here.

## Exports

| Subpath | Module | Purpose |
| --- | --- | --- |
| `@codeforge/shared/api` | `src/api.js` | Fetch wrappers for sessions, messages, billing, cowork, team, context packs, MCP, workflows |
| `@codeforge/shared/agent` | `src/agentClient.js` | Agent loop and streaming client helpers |
| `@codeforge/shared/sse` | `src/sse.js` | Routing signal parsing and SSE event formatting |
| `@codeforge/shared/sessions` | `src/sessions.js` | Session grant write/view-only helpers |

## Environment

Node clients read:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CODEFORGE_API_BASE_URL` | `http://127.0.0.1:8000` | API base (trailing slashes stripped) |

Web uses `NEXT_PUBLIC_API_BASE` in its local `api.js` wrapper instead.

## Session grants (`sessions.js`)

Team workspaces can grant cross-member session access. Helpers normalize UI behavior:

```js
import {
  canWriteSession,
  isViewOnlySession,
  viewOnlySessionMessage,
  formatSessionListLabel,
} from "@codeforge/shared/sessions";
```

| Function | Behavior |
| --- | --- |
| `canWriteSession(session)` | `false` when `access_source === "granted"` and `access_level !== "delegate"` |
| `isViewOnlySession(session)` | Negation of `canWriteSession` |
| `viewOnlySessionMessage(session)` | User-facing explanation for disabled write actions |
| `formatSessionListLabel(session)` | Appends `(granted view\|delegate from owner)` in session lists |

Web (`session-context.jsx`, `use-chat-page.js`) and desktop (`use-code-workspace.js`) both use these checks.

## Routing signals (`sse.js`)

Parse model-routing metadata from API responses and SSE payloads:

```js
import {
  routingSignalFromPayload,
  routingSignalFromMessageResponse,
  formatRoutingSignal,
  formatEvent,
} from "@codeforge/shared/sse";
```

`formatRoutingSignal` produces the banner text shown in chat/code UIs (intent, model, confidence, review-required flag).

## API client (`api.js`)

Centralized JSON fetch with bearer token support. Covers auth, sessions, messages, proposals, git/file ops, billing, orgs, cowork, team, memory, taste, RTK, skills, scrape, and platform probes.

Terminal and desktop import specific functions; the web app duplicates browser-oriented wrappers in `apps/web/lib/api.js` with the same endpoint paths.

## Adding an endpoint

1. Add the fetch helper to `packages/shared/src/api.js`.
2. Mirror it in `apps/web/lib/api.js` if the web UI needs it (browser SSE may differ).
3. Wire the desktop/terminal caller to the shared export when possible to keep semantics aligned.
