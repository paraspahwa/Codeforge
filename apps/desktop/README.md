# CodeForge Desktop

Tauri + React desktop client with Code, Cowork, Team, Analytics, Billing, and Settings. Uses the same `@codeforge/ui` components and `@codeforge/design-tokens` as the web app.

## Features

- **Code mode**: sessions, chat with slash commands (`/memory`, `/taste`, `/caveman`, `/rtk`, `/help`), git/shell, workflows, artifacts, templates — state in `use-code-workspace.js`, UI in `CodeWorkspace.jsx`
- **Cowork mode**: plans, runs, jobs, browser tasks, OCR extraction, **ScrapeGraphAI scrape** (Phase 9)
- **Team mode**: workspaces, knowledge, delegations, audit log, live SSE
- **Settings** (Phases 7–10): taste import/export, agent memory, token saver + skills toggles, RTK, Supermemory status, SSO checklist
- **Analytics**: usage, routing benchmarks, cowork reliability, synthesis rollout
- **Billing**: plan/subscription view; Razorpay checkout opens in web app (`VITE_CODEFORGE_WEB_BASE_URL`)
- **Auth**: dev login and OIDC SSO (`DesktopAuthContext`); callback `/auth/callback`

## Shared frontend packages

| Package | Usage |
| --- | --- |
| `@codeforge/ui` | `ChatMessageList`, buttons, panels — import `@codeforge/ui/styles.css` via `styles.css` |
| `@codeforge/design-tokens` | `--cf-*` theme variables |
| `@codeforge/shared` | SSE routing helpers, session grant checks (`canWriteSession`) |

See [packages/ui/README.md](../../packages/ui/README.md) and [packages/design-tokens/README.md](../../packages/design-tokens/README.md).

## Local development

```bash
npm --workspace apps/desktop run dev
```

Environment:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_CODEFORGE_API_BASE_URL` | `http://localhost:8000` | API |
| `VITE_CODEFORGE_WEB_BASE_URL` | `http://localhost:3000` | Billing checkout link |
| `VITE_CODEFORGE_PROJECT_PATH` | — | Optional default project path |

## OIDC

Register `http://localhost:1420/auth/callback` with your IdP when `CODEFORGE_OIDC_ENABLED=true` on the API.

## Production packaging (Tauri)

Release builds are separate from feature work in the monorepo:

```bash
# Install Rust toolchain + Tauri prerequisites (see https://tauri.app/start/)
npm --workspace apps/desktop run tauri build
```

Outputs land in `apps/desktop/src-tauri/target/release/bundle/` (platform-specific `.msi`, `.dmg`, `.deb`, etc.).

CI/release pipeline: wire `tauri build` into your runner with code signing and `VITE_*` production URLs baked at build time. See root `DEPLOYMENT_RUNBOOK.md` for API/worker deploy; desktop artifacts are distributed out-of-band (GitHub Releases, internal MDM, etc.).
