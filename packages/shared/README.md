# Shared Package (`@codeforge/shared`)

Browser and Node client helpers used by web, desktop, terminal, and VS Code surfaces. Keeps API paths, SSE parsing, and team/cowork contracts in one place.

## Modules

| Import path | Purpose |
| --- | --- |
| `@codeforge/shared/api` | REST helpers for sessions, team, cowork, billing, OIDC |
| `@codeforge/shared/sse` | Structured SSE stream parsing (`formatEvent`, chunk handlers) |
| `@codeforge/shared/sessions` | Session list labels, `canWriteSession`, view-only messaging |

## Team session export

```js
import { exportSession } from "@codeforge/shared/api";

// Owner or sessions visible without workspace context
await exportSession(baseUrl, token, sessionId, "markdown");

// Team-context export (pass workspace when access is grant-based)
await exportSession(baseUrl, token, sessionId, "json", workspaceId);
```

Maps to `GET /api/v1/team/session-export/{session_id}?format=...&workspace_id=...`. See `docs/tickets/phase-5-projects-team.md` for session access rules.

## Environment variables (clients)

| Variable | Surfaces | Default |
| --- | --- | --- |
| `CODEFORGE_API_BASE_URL` | terminal, VS Code | `http://127.0.0.1:8000` |
| `VITE_CODEFORGE_API_BASE_URL` | desktop (Vite) | `http://localhost:8000` |
| `NEXT_PUBLIC_API_BASE` | web | — |
| `CODEFORGE_OIDC_REDIRECT_URI` | terminal | `http://127.0.0.1:4583/auth/callback` |
