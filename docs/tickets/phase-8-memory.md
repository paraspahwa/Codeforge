# Phase 8 — RTK + Native Memory + Supermemory BYOK

## RTK shell compression

- Optional wrapper in `shell_ops.py` rewrites supported commands through the `rtk` binary.
- Toggle via `CODEFORGE_RTK_ENABLED`, user preference `rtk_enabled`, or `/rtk on|off`.
- Metrics stored per user in `user_agent_preferences.rtk_last_stats_json`.
- API: `GET /api/v1/rtk/status`

Supported commands include read-only `git`, `pytest`, `npm test`, `cargo test`, `rg`, and safe `python -m pytest`.

## Native agent memory

- Table: `agent_memories` (Postgres/SQLite).
- Vector index via existing Qdrant `vector_store.upsert_text` with `type=agent_memory`.
- Injected into `stream_session` through `memory_service.compose_memory_context`.
- Capture triggers:
  - `POST /api/v1/memory/save` and `/memory save`
  - `/workflows/compact` summary signal extraction
  - Approved proposal decisions with architectural notes

API:

- `GET /api/v1/memory`
- `GET /api/v1/memory/search?q=...`
- `POST /api/v1/memory/save`
- `GET /api/v1/memory/export`

## Supermemory BYOK

- Env: `SUPERMEMORY_CC_API_KEY`
- Per-repo: `.codeforge/supermemory.json` (see `.codeforge/supermemory.json.example`)
- API:
  - `GET /api/v1/supermemory/status`
  - `GET /api/v1/supermemory/search`
  - `POST /api/v1/supermemory/save`
- Search order: native memory first, then Supermemory when configured.

## Clients

- Terminal: `/rtk`, `/memory`, `/supermemory`
- Web and desktop Settings: **Token Saver** (RTK toggle), **Memory** tab
- Web/desktop Code chat: `/rtk`, `/memory` slash commands

## Tests

- `services/api/tests/test_rtk.py`
- `services/api/tests/test_memory.py`
