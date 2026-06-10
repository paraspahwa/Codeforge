# CodeForge Web App

Next.js 14 dashboard for chat, sessions, cowork, team, billing, and analytics. Shares UI components and API helpers with the desktop client.

## Local development

```bash
npm install          # from repo root
npm run dev:web      # http://localhost:3000
```

Environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | `http://127.0.0.1:8000` | Backend API base URL |

Start the API (`npm run api:dev`) before exercising authenticated routes.

## Architecture

```
app/layout.jsx          Root providers (auth, shell bar, toast)
  └── ShellRouter       Minimal shell for /login, /auth/*, /share/*
        └── AppShell    Nav sidebar + usage/grant badges
              └── page routes

app/page.jsx            Chat (thin view over useChatPage hook)
components/chat/        Presentational chat panels
lib/use-chat-page.js    Chat state, SSE streaming, workflows
lib/api.js              Web API wrapper (token + base URL)
```

### Provider stack

`layout.jsx` wraps the app in this order:

1. `ToastProvider` — transient notifications
2. `AuthProvider` — dev login / OIDC token storage
3. `ShellProvider` — usage summary and session grant badges for the nav bar
4. `ShellRouter` — chooses full `AppShell` or minimal layout per route

### Chat page decomposition

The chat route (`/`) was refactored into a hook + presentational components:

| Layer | File | Responsibility |
| --- | --- | --- |
| Hook | `lib/use-chat-page.js` | Sessions, messages, SSE stream, proposals, workflows, artifacts, routing signals |
| Layout | `components/chat/ChatLayout.jsx` | Three-column desktop layout; mobile tab switcher |
| Sidebar | `components/chat/SessionSidebar.jsx` | Session list, project path, usage |
| Composer | `components/chat/Composer.jsx` | Prompt input, auto mode, send |
| Activity | `components/chat/AgentActivityFeed.jsx` | Streaming agent event log |
| Workflows | `components/chat/WorkflowDrawer.jsx` | Loop, plan, compact, ultrareview, templates |
| Review | `components/chat/ProposalReview.jsx` | Diff approval/rejection |
| Conflicts | `components/chat/ConflictAssistant.jsx` | Git conflict resolution guide |
| Artifacts | `components/chat/ArtifactPanel.jsx` | Session artifact preview |
| Routing | `components/chat/RoutingSignalBanner.jsx` | Model routing confidence display |
| Messages | `@codeforge/ui` `ChatMessageList` | Markdown chat log (`variant="web"`) |

`page.jsx` composes these pieces and passes state from `useChatPage()`. New chat features should extend the hook first, then add or update a `components/chat/` panel.

### Styling

- Design tokens: `@codeforge/design-tokens/tokens.css` (imported in `globals.css`)
- Shared components: `@codeforge/ui/styles.css`
- Tailwind utilities for layout (`tailwind.config.js` scans `app/`, `components/`, and `packages/ui/`)
- Legacy `.panel`, `.chat-layout`, and `.msg` classes in `globals.css` for chat-specific layout

### Routes

| Path | Page | Auth |
| --- | --- | --- |
| `/` | Chat | Required |
| `/sessions` | Session replay | Required |
| `/cowork` | Cowork plans and runs | Required |
| `/team` | Workspaces, delegations, knowledge | Required |
| `/analytics` | Routing benchmarks | Required |
| `/billing` | Plans and checkout | Optional |
| `/settings` | Profile, MCP connectors | Required |
| `/login` | Dev login / SSO redirect | Public |
| `/auth/callback` | OIDC code exchange | Public |
| `/share/[shareId]` | Shared session resume | Public |

`AppShell` redirects unauthenticated users on protected routes to `/login`. Billing is intentionally accessible without auth so users can view plans before signing in.

## Shared packages

| Package | Role in web app |
| --- | --- |
| `@codeforge/ui` | Buttons, panels, chat log, skeletons, tabs |
| `@codeforge/design-tokens` | CSS variables and Tailwind color bridge |
| `@codeforge/shared` | SSE formatters, session grant helpers (via `lib/api.js` patterns) |

## Common pitfalls

- **Missing API**: Pages show loading or redirect to login when the backend is unreachable. Confirm `NEXT_PUBLIC_API_BASE` matches the running API port.
- **SSE disconnects**: `use-chat-page.js` holds a ref to the active `EventSource`. Switching sessions aborts the previous stream — do not open duplicate streams for the same session.
- **View-only sessions**: Team grants with `access_level: "view"` disable the composer and workflow actions. Check `canWriteSession` from `@codeforge/shared/sessions` before adding write UI.
- **Tailwind purge**: New components under `packages/ui` are already scanned. Components placed outside `app/`, `components/`, or `packages/ui/` need to be added to `tailwind.config.js` `content` array.
