# CodeForge agent instructions

## Loop Engineering (strict)

You operate in an **autonomous verify/fix loop** after every code change.

### Protocol

1. **Verify** — Run build, lint, or test commands appropriate to the files you changed (see `.codeforge/loop-engineering.yaml`).
2. **Heal** — On failure, read the full error output, apply a minimal fix, and re-run verify. Do **not** wait for user feedback between attempts.
3. **Exit** — Stop when all required commands pass, or after **5 attempts**. On limit, explain the roadblock, commands run, and what you tried.

### CodeForge monorepo quick reference

| Area | Command |
|------|---------|
| API (`services/api`) | `npm run api:test` |
| Web (`apps/web`, packages) | `npm run lint:web` → `npm run build:web` |
| VS Code ext | `npm run check:vscode` |
| Desktop (Tauri) | `cd apps/desktop/src-tauri && cargo check` |
| E2E | `npm run test:e2e` |

### API loop endpoint

`POST /api/v1/sessions/{session_id}/loop/resolve` — resolve verify commands from changed git paths + `.codeforge/loop-engineering.yaml`.

`POST /api/v1/sessions/{session_id}/agent/loop` with:

```json
{
  "auto_resolve": true,
  "max_attempts": 5,
  "auto_apply": true,
  "auto_mode": true
}
```

Or pass an explicit override: `"verify_command": "npm run api:test", "auto_resolve": false`.

Backend implementation: `services/api/app/agent_loop.py` → `run_verify_fix_loop`.

## Magic Pointer (cursor-aware context)

When the user says **"this"**, **"that"**, or **"optimize this function"**, resolve against `[ACTIVE_CURSOR_CONTEXT]` — never ask them to paste visible code.

Tagged block format:

```text
[ACTIVE_CURSOR_CONTEXT]
File: apps/web/lib/api.js
Line: 42
Selected Text: ...
Detected Entities:
- api_route: /api/v1/auth/login → Open router module; run API tests
[/ACTIVE_CURSOR_CONTEXT]
```

Web IDE: **Ctrl+Shift+G** arms pointer; **/pointer** shows bound context. Config: `.codeforge/magic-pointer.yaml`.
