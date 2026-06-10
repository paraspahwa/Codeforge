# CodeForge Desktop

Tauri + React desktop client with Code, Cowork, and Team modes.

## Features

- **Code mode**: sessions, chat, git/shell tools, workflows (`/loop`, `/plan`, artifacts, templates)
- **Cowork mode**: plans, runs, scheduled jobs, browser tasks with explicit approval
- **Team mode**: workspaces, knowledge, delegations (multi-agent orchestration + step approvals), audit log, live SSE
- **Auth**: dev login and OIDC SSO via the top app bar (`DesktopAuthContext`); callback path `/auth/callback` (Vite SPA fallback + `dist/auth/callback/index.html` copy for Tauri builds)

## Architecture

```
App.jsx                 Mode router (Code / Cowork / Team)
CodeWorkspace.jsx       Presentational Code mode view
use-code-workspace.js   Code mode state, SSE, git/shell, workflows
CoworkWorkspace.jsx     Cowork plans and runs
TeamWorkspace.jsx       Team delegations and audit
```

Code mode follows the same hook + view split as the web chat page. `useCodeWorkspace()` owns session/message state, SSE streaming, git/shell integration, and workflow actions. `CodeWorkspace.jsx` renders the layout and delegates to `@codeforge/ui` `ChatMessageList` (`variant="desktop"`).

Shared styling imports `@codeforge/design-tokens/tokens.css` and `@codeforge/ui/styles.css` in `styles.css`.

## Local development

```bash
npm --workspace apps/desktop run dev
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_CODEFORGE_API_BASE_URL` | `http://localhost:8000` | Backend API |
| `VITE_CODEFORGE_PROJECT_PATH` | (empty) | Pre-fill project folder in Code mode |

## OIDC

Register `http://localhost:1420/auth/callback` with your IdP when `CODEFORGE_OIDC_ENABLED=true` on the API.

## Related docs

- [Web app architecture](../web/README.md) — parallel chat hook/component pattern
- [@codeforge/ui](../../packages/ui/README.md) — shared component library
- [@codeforge/shared](../../packages/shared/README.md) — API and SSE helpers
