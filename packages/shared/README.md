# @codeforge/shared

Client SDK shared by web, desktop, and terminal apps. Centralizes API calls, SSE payload parsing, and workspace session-grant semantics.

## Modules

| Import | File | Purpose |
| --- | --- | --- |
| `@codeforge/shared/api` | `src/api.js` | REST helpers for auth, sessions, messages, billing, cowork, team, MCP, context packs |
| `@codeforge/shared/sse` | `src/sse.js` | Routing signal extraction and agent event formatting |
| `@codeforge/shared/sessions` | `src/sessions.js` | Granted-session read/write checks and list labels |
| `@codeforge/shared/agent` | `src/agentClient.js` | Agent loop and workflow orchestration |

## API base URL

Node and browser callers resolve the API from `CODEFORGE_API_BASE_URL` (default `http://127.0.0.1:8000`). Web uses its own `apps/web/lib/api.js` wrapper that points at `NEXT_PUBLIC_API_BASE`.

## Session grants

Team workspaces can expose sessions to members with `access_source: "granted"`:

```js
import { canWriteSession, viewOnlySessionMessage } from "@codeforge/shared/sessions";

if (!canWriteSession(session)) {
  // Disable composer, workflows, proposal actions
  const hint = viewOnlySessionMessage(session);
}
```

Only `access_level === "delegate"` allows writes on granted sessions. View-only grants are read-only across clients.

The VS Code extension webview cannot import this package; it mirrors the same functions in `apps/vscode/media/sessions-helpers.js`. Update both when grant rules change.

## SSE / routing

```js
import { routingSignalFromPayload, formatRoutingSignal } from "@codeforge/shared/sse";

const signal = routingSignalFromPayload(streamPayload);
const label = formatRoutingSignal(signal);
// "Routing: code_edit via deepseek-v4-flash · confidence high 92% · review required"
```

Used by web (`use-chat-page`), desktop (`use-code-workspace`), and terminal (routing banner).

## Adding endpoints

Extend `src/api.js` with the same `requestJson` error handling and bearer token option. Keep response shapes aligned with `services/api` OpenAPI routes. Surface-specific wrappers (web `lib/api.js`, desktop `src/api.js`) should remain thin re-exports or token injectors.

See [docs/frontend-architecture.md](../../docs/frontend-architecture.md) for client integration patterns.
