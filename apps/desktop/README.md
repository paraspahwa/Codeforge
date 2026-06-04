# CodeForge Desktop App (Phase 2)

This folder is the desktop app entry point planned after web stabilization.

## Planned Stack

- Tauri 2.x
- React frontend (shared UI patterns with web app)
- Shared API client from `packages/shared`

## Planned Features

- System tray icon + quick actions
- Global hotkey (Ctrl+Shift+Space)
- Native file picker
- Notifications for long-running tasks
- Auto-updater setup

## Next Step

Scaffold with:

```bash
npm create tauri-app@latest
```

Then wire login/session/chat flows to the existing FastAPI backend.
