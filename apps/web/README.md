# CodeForge Web App

Next.js 14 App Router client for chat, code workspace, team/cowork admin, billing, and settings. Shares UI primitives and design tokens with the Tauri desktop app.

## Quick start

From the repo root:

```bash
npm install
npm run dev:web
```

Open `http://localhost:3000`. The API must be running on port 8000 (or set `NEXT_PUBLIC_API_BASE`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | `http://127.0.0.1:8000` | FastAPI backend URL |

## Architecture

```text
app/layout.jsx          Root providers + fonts
  └─ ShellRouter        AppShell vs minimal shell (login, share, auth callback)
       └─ AppShell      Sidebar nav, auth gate, usage/grant bar
            └─ page routes

lib/
  use-chat-page.js      Chat page state (sessions, SSE, workflows, proposals)
  use-code-workspace.js Code page state (git, shell, file preview)
  auth-context.jsx      Dev login + OIDC token storage
  shell-context.jsx     Usage pill + session grant for AppShell header
  session-context.jsx   View-only / delegate write access for granted sessions
  toast-context.jsx     Imperative toast notifications
  api.js                Web-specific API wrappers (browser fetch + SSE)

components/
  chat/                 Chat-only UI (Composer, WorkflowDrawer, etc.)
  AppShell.jsx          Navigation groups and protected-route redirect
  ShellRouter.jsx       Route-based shell selection
```

### Shell routing

| Route pattern | Shell | Auth |
| --- | --- | --- |
| `/`, `/code`, `/sessions`, `/cowork`, `/team`, `/analytics`, `/settings` | `AppShell` | Required (redirect to `/login?next=…`) |
| `/billing` | `AppShell` | Optional |
| `/login`, `/auth/*`, `/share/*` | Minimal (no sidebar) | Varies |

Protected routes are defined in `components/AppShell.jsx` (`PROTECTED_PREFIXES`). Unauthenticated users are redirected to `/login` with a `next` query param.

### Page hooks vs presentational components

Heavy logic lives in hooks; pages compose UI:

| Route | Hook | Key UI |
| --- | --- | --- |
| `/` | `useChatPage` | `SessionSidebar`, `Composer`, `WorkflowDrawer`, `ProposalReview`, `ConflictAssistant` |
| `/code` | `useCodeWorkspace` | Git sidebar, shell runner, file preview, inline chat |
| `/sessions` | Page-local | Session replay via `ChatMessageList` (`variant="replay"`) |

Both hooks call `apps/web/lib/api.js`, which mirrors backend endpoints. Shared parsing helpers (routing signals, session grants) come from `@codeforge/shared`.

### Context providers

Provider tree in `app/layout.jsx`:

```text
ToastProvider → AuthProvider → ShellProvider → ShellRouter
```

- **AuthProvider** — token, user id, dev login, OIDC authorize URL
- **ShellProvider** — lets chat/code hooks push usage and session-grant info to the AppShell header
- **SessionProvider** — scoped per chat page; exposes `sessionWritable` and `isViewOnly` from `@codeforge/shared/sessions`

### Styling stack

1. `@codeforge/design-tokens/tokens.css` — `--cf-*` variables
2. `@codeforge/ui/styles.css` — shared component styles
3. Tailwind (`tailwind.config.js`) — layout utilities; content includes `packages/ui/src`
4. `app/globals.css` — app shell, sidebar, chat layout, page-specific rules

Fonts: Inter (sans) and JetBrains Mono (mono) loaded in `layout.jsx`.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Chat — proposals, workflows, slash commands (`/memory`, `/taste`, `/caveman`, `/rtk`, `/help`) |
| `/code` | Code workspace — git, shell, file preview, verify loop |
| `/sessions` | Session list and replay |
| `/cowork` | Cowork plans, browser tasks, ScrapeGraphAI scrape |
| `/team` | Workspaces, knowledge, delegations |
| `/analytics` | Usage and routing benchmarks |
| `/billing` | Plans, Razorpay checkout, org selector |
| `/settings` | Taste, memory, RTK, skills, MCP, SSO checklist |
| `/login` | Dev login or SSO; respects `dev_login_disabled_under_oidc` from deploy-readiness |
| `/auth/callback` | OIDC code exchange |
| `/share/[shareId]` | Shared session resume (minimal shell) |

PWA: `public/manifest.webmanifest` enables add-to-home-screen for mobile-friendly chat.

## Shared packages

| Package | Role in web app |
| --- | --- |
| `@codeforge/ui` | Buttons, panels, badges, `ChatMessageList`, etc. |
| `@codeforge/design-tokens` | Theme CSS variables and `theme.json` |
| `@codeforge/shared` | SSE routing helpers, session grant checks, Node/browser API client |

## Common pitfalls

- **Blank page after load** — chat and code pages return `null` while auth is resolving or when unauthenticated; check `/login` redirect and `NEXT_PUBLIC_API_BASE`.
- **SSE drops** — `useChatPage` holds a stream ref; switching sessions closes the prior stream. Network errors surface via toast.
- **View-only sessions** — granted sessions with `access_level !== "delegate"` disable write actions; `SessionProvider` gates the composer and workflow buttons.
- **Tailwind missing styles on UI components** — ensure `tailwind.config.js` content paths include `../../packages/ui/src/**/*.{js,jsx}`.

## Related docs

- [Desktop client](../desktop/README.md) — parallel Tauri shell with `useCodeWorkspace` hook
- [@codeforge/ui](../../packages/ui/README.md) — component library
- [@codeforge/design-tokens](../../packages/design-tokens/README.md) — token reference
- [Root README](../../README.md) — full monorepo setup and API env vars
