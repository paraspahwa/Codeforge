# Frontend Architecture

CodeForge clients share a small design system and client SDK. Web and desktop render the same chat primitives; the terminal and VS Code extension consume tokens and session helpers where a React tree is not available.

## Package map

| Package | Path | Role |
| --- | --- | --- |
| `@codeforge/design-tokens` | `packages/design-tokens` | CSS variables (`--cf-*`) and `theme.json` for non-CSS consumers |
| `@codeforge/ui` | `packages/ui` | Shared React components (buttons, panels, chat list, toasts) |
| `@codeforge/shared` | `packages/shared` | API helpers, SSE/routing formatters, session grant semantics |

Workspace apps depend on these packages via npm workspaces (`apps/web`, `apps/desktop`, `apps/terminal`).

## Styling contract

1. Import tokens and UI base styles at the app entry:

```css
@import "@codeforge/design-tokens/tokens.css";
@import "@codeforge/ui/styles.css";
```

2. Use `--cf-*` variables for new styles. Legacy aliases (`--primary`, `--surface`, etc.) remain during migration.
3. Web adds Tailwind utilities mapped to tokens in `apps/web/tailwind.config.js` (for example `bg-cfbg`, `text-cfprimary`). Prefer tokens in shared UI; use Tailwind for page layout in the web app only.

Terminal maps `theme.json` to Ink colors in `apps/terminal/src/inkTheme.js`.

## `@codeforge/ui` components

Exported from `packages/ui/src/index.js`:

| Export | Use |
| --- | --- |
| `Button`, `IconButton` | Primary actions, icon-only controls |
| `Input`, `Textarea`, `Select` | Form fields |
| `Panel`, `Card`, `Divider` | Layout shells |
| `Badge` | Status chips (plan tier, grant level) |
| `Tabs` | Settings, team, cowork sub-views |
| `EmptyState`, `Skeleton` | Loading and zero-data states |
| `Banner` | Routing review and inline warnings |
| `Toast`, `ToastStack` | Transient feedback (web uses its own `ToastProvider`; desktop has a local copy) |
| `CodeBlock` | Syntax-highlighted fenced code (highlight.js) |
| `ChatMessageList` | Markdown chat log with `variant="web"` or `variant="desktop"` |

`ChatMessageList` renders GFM markdown, highlights code blocks, and accepts `streamingMessageId` for the active assistant stream cursor.

## `@codeforge/shared` modules

| Import path | Contents |
| --- | --- |
| `@codeforge/shared/api` | `devLogin`, session/message APIs, cowork, team, billing, MCP, context packs |
| `@codeforge/shared/sse` | `routingSignalFromPayload`, `formatRoutingSignal`, `formatEvent` |
| `@codeforge/shared/sessions` | `canWriteSession`, `isViewOnlySession`, `viewOnlySessionMessage`, `formatSessionListLabel` |
| `@codeforge/shared/agent` | Agent loop and workflow client helpers |

Session grant helpers gate write actions when `access_source === "granted"` and `access_level !== "delegate"`. Web and desktop import these directly; the VS Code webview mirrors the same logic in `apps/vscode/media/sessions-helpers.js` (keep in sync when grant semantics change).

## Web app (`apps/web`)

### Shell and auth

```
RootLayout
  ToastProvider → AuthProvider → ShellProvider → ShellRouter
```

- `ShellRouter` renders a minimal chrome-free shell on `/login`, `/auth/*`, and `/share/*`; all other routes use `AppShell` (sidebar nav, usage badge, session-grant banner).
- `AppShell` redirects unauthenticated users on protected routes to `/login?next=<path>`. Billing (`/billing`) stays public.
- `ShellProvider` (`lib/shell-context.jsx`) lifts usage summary and active session grant into the top bar. Chat page updates these via `useShellBar()`.

### Chat page decomposition

`app/page.jsx` is a thin view over `useChatPage()` (`lib/use-chat-page.js`). The hook owns session state, SSE streaming, workflows, artifacts, proposals, and routing signals. Presentational pieces live under `components/chat/`:

| Component | Responsibility |
| --- | --- |
| `SessionSidebar` | Project path, session list/filter, usage |
| `Composer` | Prompt input, auto-mode, send |
| `ChatMessageList` | Message log (from `@codeforge/ui`) |
| `RoutingSignalBanner` | Confidence / review-required signal |
| `ProposalReview` | Approve/reject streamed diffs |
| `WorkflowDrawer` | Loop, plan, compact, ultrareview, fork |
| `ConflictAssistant` | Git conflict guide and apply |
| `ArtifactPanel` | Session artifact preview |
| `AgentActivityFeed` | Streamed tool/agent events |
| `ChatLayout` | Two-column layout wrapper |

`SessionProvider` (`lib/session-context.jsx`) exposes `sessionWritable` and `isViewOnly` to descendants based on `@codeforge/shared/sessions`.

### Other routes

Cowork, team, settings, analytics, billing, and sessions pages import `@codeforge/ui` primitives (`Tabs`, `EmptyState`, `Skeleton`) and follow the same token-driven CSS in `app/globals.css`.

## Desktop app (`apps/desktop`)

### Mode shell

`App.jsx` switches between Code, Cowork, and Team workspaces after `DesktopAuthProvider` issues a token. Login supports dev user ID or OIDC when the API reports OIDC enabled.

### Code workspace

`CodeWorkspace.jsx` is a view layer over `useCodeWorkspace()` (`use-code-workspace.js`). The hook mirrors web chat behavior (sessions, SSE, git/shell tools, workflows, artifacts) and persists `projectPath` / `sessionId` to `localStorage` key `codeforge.desktop.code`.

Notifications use `ToastProvider` + `useDesktopNotify()`:

- `reportError(message)` — inline error state and error toast
- `reportSuccess(message)` — status line and success toast

Environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_CODEFORGE_API_BASE_URL` | `http://localhost:8000` | API base |
| `VITE_CODEFORGE_PROJECT_PATH` | — | Initial project folder |

## Terminal and VS Code

- **Terminal**: `inkTheme.js` imports `theme.json`; CLI renders routing banners with `@codeforge/shared/sse` formatters.
- **VS Code**: Panel CSS follows token colors; `sessions-helpers.js` duplicates grant checks for the webview bundle (no workspace import).

## Adding UI to a new client

1. Add `@codeforge/design-tokens` and `@codeforge/ui` to the app `package.json`.
2. Import `tokens.css` and `ui/styles.css` in the app stylesheet.
3. Prefer `@codeforge/shared` for API and session logic instead of copying fetch helpers.
4. For chat surfaces, reuse `ChatMessageList` with the appropriate `variant`.
5. If the client cannot import workspace packages (VS Code webview), mirror session grant helpers and document the sync point.

## Common pitfalls

- **Stale VS Code grant helpers**: Changing `packages/shared/src/sessions.js` requires updating `apps/vscode/media/sessions-helpers.js`.
- **Token vs Tailwind drift**: New colors belong in `tokens.css` first; extend `tailwind.config.js` only for web layout utilities.
- **Missing style imports**: Components from `@codeforge/ui` expect `tokens.css` and `ui/styles.css` to be loaded by the host app.
- **View-only sessions**: Disable compose, workflows, and proposal actions when `canWriteSession` returns false; show `viewOnlySessionMessage` in the composer banner.
