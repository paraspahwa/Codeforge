# CodeForge Desktop

Tauri + React desktop client with Code, Cowork, and Team modes.

## Features

- **Code mode**: sessions, chat, git/shell tools, workflows (`/loop`, `/plan`, artifacts, templates)
- **Cowork mode**: plans, runs, scheduled jobs, browser tasks with explicit approval
- **Team mode**: workspaces, knowledge, delegations (multi-agent orchestration + step approvals), audit log, live SSE
- **Auth**: dev login and OIDC SSO via the top app bar (`DesktopAuthContext`); callback path `/auth/callback` (Vite SPA fallback + `dist/auth/callback/index.html` copy for Tauri builds)

## Architecture

| Piece | Path | Role |
| --- | --- | --- |
| Code state | `use-code-workspace.js` | Sessions, SSE, git/shell, loop, plans, proposals, artifacts |
| Notifications | `useDesktopNotify.js` | Tauri tray + status line |
| Toasts | `toast-context.jsx` | Ephemeral error/success messages |
| API | `api.js` | Wraps `@codeforge/shared` with `VITE_CODEFORGE_API_BASE_URL` |
| UI | `@codeforge/ui` | `ChatMessageList` and shared styles |
| Theme | `@codeforge/design-tokens` | `tokens.css` imported in `styles.css` |

See [docs/client-architecture.md](../../docs/client-architecture.md) for cross-surface patterns (SSE, session grants, workflows).

## Local development

```bash
npm --workspace apps/desktop run dev
```

Environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_CODEFORGE_API_BASE_URL` | `http://localhost:8000` | Backend API |
| `VITE_CODEFORGE_PROJECT_PATH` | (empty) | Initial workspace folder for Code mode |

Workspace state (`projectPath`, `sessionId`) persists in local storage via `desktop-auth.js`.

## OIDC

Register `http://localhost:1420/auth/callback` with your IdP when `CODEFORGE_OIDC_ENABLED=true` on the API.
