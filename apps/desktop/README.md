# CodeForge Desktop

Tauri + React desktop client with Code, Cowork, and Team modes.

## Features

- **Code mode**: sessions, chat, git/shell tools, workflows (`/loop`, `/plan`, artifacts, templates)
- **Cowork mode**: plans, runs, scheduled jobs, browser tasks with explicit approval
- **Team mode**: workspaces, knowledge, delegations (multi-agent orchestration + step approvals), audit log, live SSE
- **Auth**: dev login and OIDC SSO via the top app bar (`DesktopAuthContext`); callback path `/auth/callback`

## Local storage keys

Desktop separates auth tokens from Code workspace preferences:

| Key | Module | Contents |
| --- | --- | --- |
| `codeforge.desktop.auth` | `desktop-auth.js` | `token`, `userId` |
| `codeforge.desktop.workspace` | `desktop-auth.js` | `projectPath`, `sessionId` (no credentials) |
| `codeforge.desktop.oidc_state` | `desktop-auth.js` | OIDC PKCE/state during SSO |

`clearDesktopAuth()` wipes auth and workspace prefs. Legacy `codeforge.desktop.code` entries are migrated on read (tokens move to auth key; project/session prefs move to workspace key).

## Local development

```bash
npm --workspace apps/desktop run dev
```

Set `VITE_CODEFORGE_API_BASE_URL` (default `http://localhost:8000`).

## OIDC

Register `http://localhost:1420/auth/callback` with your IdP when `CODEFORGE_OIDC_ENABLED=true` on the API.

The desktop app is a Vite SPA on port 1420. OIDC redirects land on `/auth/callback`, which must serve `index.html`:

- **Dev server** — `vite.config.js` rewrites `/auth/*` requests to `/` via the `codeforge-spa-fallback` plugin.
- **Production Tauri build** — `closeBundle` copies `dist/index.html` to `dist/auth/callback/index.html` so file-based loading works without a dev middleware.

If SSO callback shows a blank page, confirm the build output includes `dist/auth/callback/index.html` and that the IdP redirect URI matches `desktopRedirectUri()` (`{origin}/auth/callback`).
