# Phase 2 - Platform Surfaces

## Goal

Extend the shared backend across web, desktop, and VS Code.

## Status

- T2.1 web dashboard expansion: done
- T2.2 desktop workspace improvements: done
- T2.3 VS Code extension MVP: done, manifest, backend-backed panel, inline diff preview, live editor-context sync, status bar actions, editor title actions, and explain/refactor/review command entry points are scaffolded
- T2.4 shared client SDK hardening: done, shared helpers now include context-pack and MCP connector APIs aligned across backend/web/node clients

## Tickets

### T2.1 - Web dashboard expansion

- Add richer session replay, analytics, billing, and settings screens.
- Keep proposal review visible in the web UI.
- Acceptance: the web client can review and resolve proposals.

### T2.2 - Desktop workspace improvements

- Expand the Tauri shell into a clearer coding workspace.
- Add richer project controls and updater hooks when ready.
- Acceptance: the desktop app can support core code-mode workflows.

### T2.3 - VS Code extension MVP

- Scaffold the extension manifest, webview, and commands.
- Add chat, explain, refactor, and diff entry points.
- Current state: `apps/vscode` now contains the extension manifest, a backend-backed webview panel, inline proposal diff preview, live editor-context sync, status bar actions, editor title actions, and command palette entry points for open, explain, refactor, and review.
- Acceptance: VS Code can connect to the same backend session model.

### T2.4 - Shared client SDK hardening

- Keep session, streaming, billing, and proposal helpers aligned.
- Centralize payload parsing for all clients.
- Current state: shared client modules now expose context manager (`/api/v1/context/*`) and MCP connector (`/api/v1/mcp/*`) helpers on the same auth and error semantics.
- Acceptance: browser and Node clients use the same helper semantics.
