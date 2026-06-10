# CodeForge Desktop

Tauri + React desktop client with Code, Cowork, and Team modes.

## Features

- **Code mode**: sessions, chat, git/shell tools, workflows (`/loop`, `/plan`, artifacts, templates)
- **Cowork mode**: plans, runs, scheduled jobs, browser tasks with explicit approval
- **Team mode**: workspaces, knowledge, delegations (multi-agent orchestration + step approvals), audit log, live SSE
- **Auth**: dev login and OIDC SSO via the top app bar (`DesktopAuthContext`); callback path `/auth/callback` (Vite SPA fallback + `dist/auth/callback/index.html` copy for Tauri builds)

## Local development

```bash
npm --workspace apps/desktop run dev
```

Set `VITE_CODEFORGE_API_BASE_URL` (default `http://localhost:8000`).

## OIDC

Register `http://localhost:1420/auth/callback` with your IdP when `CODEFORGE_OIDC_ENABLED=true` on the API.
