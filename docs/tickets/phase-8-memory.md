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
- `GET /api/v1/memory/search?q=...` — optional `project_path`; omit to search across all memories for the user
- `POST /api/v1/memory/save`
- `GET /api/v1/memory/export`

### Search behavior

`search_memories` merges vector hits (Qdrant/in-memory) with SQL keyword fallback:

- **Vector**: semantic match on `type=agent_memory` points, filtered by `user_id` and optional `project_id`
- **Keyword**: tokenizes the query on whitespace; each token (≥2 chars) must appear in `content` (AND match). Returns empty when no qualifying tokens.
- When `project_path` is omitted, keyword search is not scoped to a project (global user memories).

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
- Web Settings: **Token Saver** (RTK toggle), **Memory** tab

## Tests

- `services/api/tests/test_rtk.py`
- `services/api/tests/test_memory.py`
