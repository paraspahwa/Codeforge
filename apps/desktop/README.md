# CodeForge Desktop

Tauri + Vite + React desktop client with Code, Cowork, and Team modes.

## Features

- **Code mode**: sessions, chat, git/shell tools, workflows (`/loop`, `/plan`, artifacts, templates)
- **Cowork mode**: plans, runs, scheduled jobs, browser tasks with explicit approval
- **Team mode**: workspaces, knowledge, delegations (multi-agent orchestration + step approvals), audit log, live SSE
- **Auth**: dev login and OIDC SSO via the top app bar (`DesktopAuthContext`); callback path `/auth/callback` (Vite SPA fallback + `dist/auth/callback/index.html` copy for Tauri builds)

## Architecture

Code mode follows the same hook-driven pattern as the web chat page:

| Module | Role |
| --- | --- |
| `useCodeWorkspace` | Session list, messaging, SSE, git/shell, workflows, artifacts |
| `CodeWorkspace.jsx` | Presentational layout; delegates state to the hook |
| `useDesktopNotify` | OS notifications for completed/error workflows |
| `toast-context.jsx` | In-app toasts (`push(message, "success" \| "error")`) |

Shared packages:

```css
/* src/styles.css */
@import "@codeforge/design-tokens/tokens.css";
@import "@codeforge/ui/styles.css";
```

- `@codeforge/shared` — API and session-grant helpers via `src/api.js`
- `@codeforge/ui` — `ChatMessageList` with `variant="desktop"`

See [docs/frontend-architecture.md](../../docs/frontend-architecture.md) for cross-client conventions.

## Local development

```bash
npm --workspace apps/desktop run dev
# or from repo root:
npm run dev:desktop
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_CODEFORGE_API_BASE_URL` | `http://localhost:8000` | Backend API |
| `VITE_CODEFORGE_PROJECT_PATH` | (none) | Optional default project folder |

Tauri dev/build requires the Rust toolchain.

## OIDC

Register `http://localhost:1420/auth/callback` with your IdP when `CODEFORGE_OIDC_ENABLED=true` on the API.

## Session grants

When a session is shared via workspace grants, `canWriteSession` from `@codeforge/shared/sessions` gates send, loop, and proposal actions. `formatSessionListLabel` annotates granted sessions in the sidebar.
