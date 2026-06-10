# Client Architecture

How CodeForge web and desktop clients share UI, API helpers, and chat logic after the platform-surface refactor.

## Package layers

```
┌─────────────────────────────────────────────────────────┐
│  apps/web          apps/desktop        apps/terminal    │
│  (Next.js)         (Tauri + React)     (Ink)            │
├─────────────────────────────────────────────────────────┤
│  app-specific      use-code-workspace  inkTheme.js      │
│  use-chat-page     toast-context       cli.jsx          │
│  lib/api.js        api.js (local)                       │
├─────────────────────────────────────────────────────────┤
│  @codeforge/ui     @codeforge/ui       (not used)       │
│  @codeforge/design-tokens              theme.json only  │
├─────────────────────────────────────────────────────────┤
│  @codeforge/shared  (api · agent · sse · sessions)      │
└─────────────────────────────────────────────────────────┘
                          │
                    FastAPI backend
```

| Package | Doc |
| --- | --- |
| `@codeforge/shared` | [packages/shared/README.md](../packages/shared/README.md) |
| `@codeforge/ui` | [packages/ui/README.md](../packages/ui/README.md) |
| `@codeforge/design-tokens` | [packages/design-tokens/README.md](../packages/design-tokens/README.md) |

## Web app (`apps/web`)

### Routing and shell

- `app/layout.jsx` wraps all pages with `ToastProvider` → `AuthProvider` → `ShellProvider` → `ShellRouter`.
- `ShellRouter` renders a minimal chrome (no sidebar) for `/login`, `/auth/*`, and `/share/*`; all other routes use `AppShell` with nav and usage bar.
- Unauthenticated users redirect to `/login?next=<path>` from `AppShell`.

### Chat page decomposition

The home chat surface (`app/page.jsx`) is a thin view over `useChatPage()`:

| Layer | Path | Responsibility |
| --- | --- | --- |
| Hook | `lib/use-chat-page.js` | Session list, SSE streaming, workflows, proposals, artifacts, routing signals |
| Context | `lib/session-context.jsx` | `canWriteSession` / view-only grant state for child components |
| Context | `lib/shell-context.jsx` | Usage summary and session-grant badge for `AppShell` |
| Components | `components/chat/*` | Presentational panels (sidebar, composer, workflows, conflict assist) |
| UI | `@codeforge/ui` | `ChatMessageList`, buttons, banners, skeletons |

`lib/api.js` re-exports `@codeforge/shared/api` with `NEXT_PUBLIC_API_BASE` baked in. Do not duplicate REST paths in page components — add wrappers here.

### Styling

- Tailwind is configured (`tailwind.config.js`, `postcss.config.js`) but most layout uses design-token CSS variables via `globals.css`.
- Fonts: Inter + JetBrains Mono from `next/font/google`, mapped to `--font-inter` / `--font-mono`.

### Auth flow

1. `/login` — dev login (when OIDC off) or SSO button (when OIDC on).
2. `/auth/callback` — OIDC code exchange via `completeOidcCallback`.
3. Token stored in `auth-context`; API wrappers attach `Authorization: Bearer`.

## Desktop app (`apps/desktop`)

### Workspaces

| Mode | Entry | State hook |
| --- | --- | --- |
| Code | `CodeWorkspace.jsx` | `use-code-workspace.js` |
| Cowork | `CoworkWorkspace.jsx` | (inline state + cowork API) |
| Team | `TeamWorkspace.jsx` | (inline state + team SSE) |

`use-code-workspace.js` mirrors web `useChatPage` for sessions, streaming, git/shell, loop, plans, and artifacts. It persists `projectPath` and `sessionId` via `desktop-auth` local storage.

Notifications use `useDesktopNotify` + Tauri tray; toasts use `toast-context.jsx` (desktop-local, not `@codeforge/ui/Toast`).

### API

`src/api.js` calls `@codeforge/shared` directly with `VITE_CODEFORGE_API_BASE_URL` (default `http://localhost:8000`).

## Cross-surface patterns

### SSE streaming

1. `sendMessage` returns routing metadata (model, confidence, review flag).
2. Client opens `streamSessionEvents` (or web `streamSession` wrapper) and appends `token` events to the active assistant message.
3. On `complete`, refresh proposals/artifacts and clear `streamingMessageId`.

Parse routing with `@codeforge/shared/sse`:

```js
import { routingSignalFromMessageResponse, formatRoutingSignal } from "@codeforge/shared/sse";
```

### Session grants (team)

Granted sessions appear in `listSessions` with `access_source: "granted"` and `access_level: "view" | "delegate"`.

- Use `canWriteSession(session)` before enabling composer, loop, or proposal actions.
- `SessionProvider` (web) and inline checks (desktop) gate write UI.
- View-only sessions show `viewOnlySessionMessage(session)` in the composer.

### Workflows

Shared across web hook, desktop hook, terminal, and VS Code:

| Workflow | API | Typical trigger |
| --- | --- | --- |
| Agent loop | `runAgentLoop` | `/loop` or WorkflowDrawer |
| Plan | `createWorkflowPlan` → `executeWorkflowPlan` | `/plan` |
| Compact | `compactWorkflow` | `/compact` |
| Ultrareview | `ultrareviewWorkflow` | `/ultrareview` |
| Fork | `forkSession` | session branch |

## Adding a feature to all code surfaces

1. Add the REST route and tests in `services/api`.
2. Add the client function to `packages/shared/src/api.js`.
3. Wire web: `apps/web/lib/api.js` wrapper + `use-chat-page.js` handler + chat component if needed.
4. Wire desktop: `apps/desktop/src/api.js` + `use-code-workspace.js`.
5. Wire terminal/VS Code if the workflow is code-mode specific.
6. Use `@codeforge/ui` components on web/desktop for consistent UX.

## Local dev commands

```bash
npm run dev:web       # http://localhost:3000
npm run dev:desktop   # Tauri + Vite http://localhost:1420
npm run dev:terminal  # Ink CLI
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Styles look unstyled | Ensure `tokens.css` and `@codeforge/ui/styles.css` are imported in app CSS |
| API 401 on web | Token in `auth-context`; `NEXT_PUBLIC_API_BASE` matches running API |
| View-only session can't send | Expected when `access_level` is `view`; request delegate grant on Team page |
| Desktop loses session on restart | `loadWorkspaceState` / `saveWorkspaceState` in `desktop-auth.js` |
| Routing banner empty | `sendMessage` response must include `confidence_score`; check backend routing policy |
