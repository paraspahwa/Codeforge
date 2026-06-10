# Phase 1 - Terminal Parity

## Goal

Bring the terminal client closer to Claude Code style interactions.

## Status

- T1.6 split-pane layout: done, sessions/chat/file/diff-review/activity panes are present
- T1.7 command palette and modes: done, Ctrl+P palette and /mode commands are present
- T1.8 approval display: done, approval events stream and approve/reject actions are present
- Team live events: done — background `streamTeamEvents` SSE while logged in; `/team events` shows the last 20 buffered events (heartbeats filtered)

## Tickets

### T1.6 - Split-pane layout
- Add file, chat, and diff panes to the Ink client.
- Keep keyboard navigation simple and predictable.
- Acceptance: the terminal surface can show session state and streaming output together.

### T1.7 - Command palette and modes
- Add command palette actions for login, session switching, clear, and quit.
- Support clear workflow states for code/edit/review loops.
- Acceptance: common workflow actions are available without leaving the terminal UI.

### T1.8 - Approval display
- Render diff and approval request events clearly.
- Support approve/reject handoff from the terminal flow.
- Acceptance: the terminal can surface a proposal before apply.
