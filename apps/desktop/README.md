# CodeForge Desktop

Tauri + React desktop client with Code, Cowork, and Team modes.

## Features

- **Code mode**: sessions, chat, git/shell tools, workflows (`/loop`, `/plan`, artifacts, templates)
- **Cowork mode**: plans, runs, scheduled jobs, browser tasks with explicit approval
- **Team mode**: workspaces, knowledge, delegations (multi-agent orchestration + step approvals), audit log, live SSE
- **Auth**: dev login and OIDC SSO via the top app bar (`DesktopAuthContext`); callback path `/auth/callback`

## Architecture

| Layer | Location | Role |
| --- | --- | --- |
| Mode shell | `App.jsx` | Auth gate, mode tabs (Code / Cowork / Team) |
| Code view | `CodeWorkspace.jsx` | Layout over `useCodeWorkspace()` |
| Code state | `use-code-workspace.js` | Sessions, SSE, git/shell, workflows, artifacts |
| Notifications | `toast-context.jsx`, `useDesktopNotify.js` | Toasts + inline status/error lines |
| Styles | `styles.css` | Imports `@codeforge/design-tokens` and `@codeforge/ui` |

`CodeWorkspace` and web chat share `ChatMessageList` from `@codeforge/ui` (`variant="desktop"`). Session grant checks use `@codeforge/shared/sessions`.

Persisted Code workspace state (`projectPath`, `sessionId`) is stored under `localStorage` key `codeforge.desktop.code`.

## Local development

```bash
npm --workspace apps/desktop run dev
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_CODEFORGE_API_BASE_URL` | `http://localhost:8000` | API base URL |
| `VITE_CODEFORGE_PROJECT_PATH` | — | Optional initial project folder |

## OIDC

Register `http://localhost:1420/auth/callback` with your IdP when `CODEFORGE_OIDC_ENABLED=true` on the API.

See [docs/frontend-architecture.md](../../docs/frontend-architecture.md) for the shared client stack.
