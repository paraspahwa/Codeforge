# Frontend Architecture

CodeForge clients share three workspace packages and follow a consistent pattern: **design tokens → UI primitives → app-specific hooks and layouts**.

## Package Layer

| Package | Path | Consumers | Role |
| --- | --- | --- | --- |
| `@codeforge/design-tokens` | `packages/design-tokens` | Web, desktop, terminal | CSS variables (`--cf-*`) and `theme.json` for non-CSS runtimes |
| `@codeforge/ui` | `packages/ui` | Web, desktop | React primitives (buttons, panels, chat list, toasts) |
| `@codeforge/shared` | `packages/shared` | Web, desktop, terminal | API client, SSE helpers, session-grant semantics |

See each package README for import paths and export lists:

- [packages/design-tokens/README.md](../packages/design-tokens/README.md)
- [packages/ui/README.md](../packages/ui/README.md)
- [packages/shared/README.md](../packages/shared/README.md)

### Styling convention

Web and desktop import tokens and UI styles at the app root:

```css
@import "@codeforge/design-tokens/tokens.css";
@import "@codeforge/ui/styles.css";
```

Use `--cf-*` variables in new styles. Legacy aliases (`--primary`, etc.) remain during migration.

The terminal reads `theme.json` via `apps/terminal/src/inkTheme.js` because Ink does not consume CSS variables.

## Web App (`apps/web`)

Next.js 14 App Router with Tailwind for layout utilities. Business logic lives in hooks; route files stay thin.

### Provider stack

`app/layout.jsx` wraps every page:

```
ToastProvider → AuthProvider → ShellProvider → ShellRouter → {page}
```

| Provider | File | Purpose |
| --- | --- | --- |
| `ToastProvider` | `lib/toast-context.jsx` | Ephemeral status toasts (`push(message, type?)`) |
| `AuthProvider` | `lib/auth-context.jsx` | Token, OIDC/dev login, protected-route gating |
| `ShellProvider` | `lib/shell-context.jsx` | Usage summary and session-grant badge for `AppShell` |
| `ShellRouter` | `components/ShellRouter.jsx` | Full `AppShell` vs minimal chrome |

### Shell routing

`ShellRouter` renders a minimal wrapper (no sidebar) for:

- `/login`
- `/auth/*` (OIDC callback)
- `/share/*` (public share resume)

All other routes render `AppShell` with grouped navigation (Build, Automate, Team, Account).

`AppShell` redirects unauthenticated users on protected routes to `/login?next=…`. Billing (`/billing`) is intentionally public so checkout links work without a prior session.

### Chat page decomposition

The home chat route (`app/page.jsx`) was split into a hook + presentational components:

```
useChatPage()  →  state, API calls, SSE streaming, workflow handlers
       ↓
SessionProvider  →  grant-aware write access for child components
       ↓
ChatLayout(sidebar | chat | activity)
```

| Piece | Location | Responsibility |
| --- | --- | --- |
| `useChatPage` | `lib/use-chat-page.js` | Sessions, messages, proposals, workflows, artifacts, routing signals |
| `SessionProvider` | `lib/session-context.jsx` | `canWriteSession` / `isViewOnly` for the active session |
| `SessionSidebar` | `components/chat/SessionSidebar.jsx` | Project path, session list, usage |
| `Composer` | `components/chat/Composer.jsx` | Prompt input and send |
| `WorkflowDrawer` | `components/chat/WorkflowDrawer.jsx` | Loop, plan, compact, ultrareview, fork, templates |
| `ProposalReview` | `components/chat/ProposalReview.jsx` | Approve/reject streamed diffs |
| `ConflictAssistant` | `components/chat/ConflictAssistant.jsx` | Git conflict guide + apply |
| `ArtifactPanel` | `components/chat/ArtifactPanel.jsx` | Session artifact preview |
| `AgentActivityFeed` | `components/chat/AgentActivityFeed.jsx` | Tool/diff/agent event stream |
| `RoutingSignalBanner` | `components/chat/RoutingSignalBanner.jsx` | Model routing confidence display |
| `ChatLayout` | `components/chat/ChatLayout.jsx` | Three-column layout with mobile tab switching |
| `ChatMessageList` | `@codeforge/ui` | Markdown rendering with `variant="web"` |

`useChatPage` publishes `usage` and `sessionGrant` into `ShellProvider` so the top bar can show limits and view-only badges without prop drilling.

### Adding a new web page

1. Create `app/<route>/page.jsx` as a client component when it needs auth or API access.
2. Reuse `@codeforge/ui` primitives and `@codeforge/shared` API helpers (web wraps shared calls in `lib/api.js` with the configured base URL).
3. If the page needs the sidebar, no extra shell work is required. For full-bleed or auth-only pages, add the path prefix to `ShellRouter.isMinimalRoute`.
4. For grant-sensitive write actions, use `canWriteSession` from `@codeforge/shared/sessions` or wrap subtrees in `SessionProvider`.

### Local web setup

```bash
npm install
npm run dev:web
```

Environment: `NEXT_PUBLIC_API_BASE` (default `http://127.0.0.1:8000`).

## Desktop App (`apps/desktop`)

Tauri + Vite + React. Code mode logic was extracted from `CodeWorkspace.jsx` into `useCodeWorkspace` (`src/use-code-workspace.js`), mirroring the web `useChatPage` pattern.

| Module | Role |
| --- | --- |
| `useCodeWorkspace` | Sessions, chat, git, shell, workflows, artifacts |
| `useDesktopNotify` | Tray/status notifications for long-running ops |
| `toast-context.jsx` | Same toast API as web (`push`, auto-dismiss 5s) |
| `DesktopAuthContext` | Dev login + OIDC, persists workspace state |

Styles import the same token and UI CSS as web. `ChatMessageList` uses `variant="desktop"`.

Environment:

- `VITE_CODEFORGE_API_BASE_URL` — API base (default `http://localhost:8000`)
- `VITE_CODEFORGE_PROJECT_PATH` — optional default project folder

See [apps/desktop/README.md](../apps/desktop/README.md) for mode overview and OIDC callback URL.

## Terminal (`apps/terminal`)

Ink client imports `@codeforge/shared/api`, `@codeforge/shared/sse`, and `@codeforge/shared/sessions` directly. Colors come from `@codeforge/design-tokens/theme.json` through `inkTheme.js`.

## VS Code Extension (`apps/vscode`)

The webview cannot import workspace packages. Session-grant helpers are duplicated in `media/sessions-helpers.js` with an explicit sync comment — update both files when grant semantics change in `packages/shared/src/sessions.js`.

## Session Grants (cross-client)

Workspace session grants attach `access_source: "granted"` and `access_level` (`view` | `delegate`) to session list entries.

| Helper | Write allowed when |
| --- | --- |
| `canWriteSession(session)` | Not granted, or `access_level === "delegate"` |
| `isViewOnlySession(session)` | Granted with `view` level |
| `formatSessionListLabel(session)` | Appends `(granted view\|delegate from <owner>)` |
| `viewOnlySessionMessage(session)` | User-facing banner text for read-only sessions |

Clients must disable send, loop, plan, and proposal actions when `canWriteSession` returns false. Web surfaces this in `AppShell` (badge) and per-component `sessionWritable` props.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Unstyled web/desktop UI | Missing CSS imports | Ensure `tokens.css` and `@codeforge/ui/styles.css` are imported in app globals |
| `useToast must be used inside ToastProvider` | Page rendered outside layout providers | Mount under `app/layout.jsx` provider tree |
| Redirect loop on login | `next` param not relative | `login/page.jsx` only accepts paths starting with `/` |
| Terminal colors differ from web | Stale `theme.json` | Update `packages/design-tokens/theme.json` and `tokens.css` together |
| VS Code grant behavior differs | `sessions-helpers.js` drift | Compare with `packages/shared/src/sessions.js` |
