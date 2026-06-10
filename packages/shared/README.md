# @codeforge/shared

Cross-client JavaScript SDK for the CodeForge backend API. Used by web, desktop, terminal, and VS Code surfaces.

## Module exports

| Import path | Module | Purpose |
| --- | --- | --- |
| `@codeforge/shared/api` | `api.js` | REST helpers for sessions, messages, billing, cowork, team, workflows |
| `@codeforge/shared/agent` | `agentClient.js` | Agent loop and tool orchestration client |
| `@codeforge/shared/sse` | `sse.js` | SSE event parsing, routing signal formatting |
| `@codeforge/shared/sessions` | `sessions.js` | Session grant access-level helpers |

## API module

All functions take `(baseUrl, token, ...)` as the first arguments unless noted. Base URL defaults to `process.env.CODEFORGE_API_BASE_URL` or `http://127.0.0.1:8000`.

```js
import { devLogin, listSessions, sendMessage } from "@codeforge/shared/api";

const { access_token } = await devLogin("http://127.0.0.1:8000", "paras");
const sessions = await listSessions("http://127.0.0.1:8000", access_token);
```

Surface-specific wrappers in `apps/web/lib/api.js` and `apps/desktop/src/api.js` re-export or extend these helpers with app-local base URL and auth context. Prefer the shared module for new cross-surface endpoints.

## SSE module

Parses structured streaming events and routing confidence signals from the backend:

```js
import {
  formatEvent,
  formatRoutingSignal,
  routingSignalFromPayload,
  routingSignalFromMessageResponse,
} from "@codeforge/shared/sse";

const label = formatRoutingSignal(routingSignalFromMessageResponse(response));
// "Routing: code_edit via deepseek-v4-flash · confidence high 92% · tier pro"
```

`formatEvent` produces human-readable one-liners for agent activity feeds (tool calls, diffs, plan steps).

## Sessions module

Handles team workspace session grants where a user has view-only or delegate access to another member's session:

```js
import { canWriteSession, isViewOnlySession, viewOnlySessionMessage } from "@codeforge/shared/sessions";

if (!canWriteSession(currentSession)) {
  // disable composer, proposals, workflows
}
```

| Function | Returns `true` when |
| --- | --- |
| `canWriteSession(session)` | User can send messages and run workflows |
| `isViewOnlySession(session)` | Session is granted with `access_level !== "delegate"` |
| `viewOnlySessionMessage(session)` | Human-readable restriction message |
| `formatSessionListLabel(session)` | Session ID with grant annotation for sidebars |

## Environment variables

| Variable | Default | Used by |
| --- | --- | --- |
| `CODEFORGE_API_BASE_URL` | `http://127.0.0.1:8000` | All clients via `api.js` |

Surface-specific env vars (`NEXT_PUBLIC_API_BASE`, `VITE_CODEFORGE_API_BASE_URL`) are resolved in each app's local API wrapper, not in this package.

## Adding new endpoints

1. Add the REST helper to `packages/shared/src/api.js`.
2. Export it from the `./api` subpath (no index re-export needed — subpath exports are explicit).
3. Wire into surface wrappers (`apps/web/lib/api.js`, `apps/desktop/src/api.js`) if the surface needs auth token injection.
4. Add SSE formatters to `sse.js` only when the event type needs cross-surface display logic.
