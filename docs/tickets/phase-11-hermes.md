# Phase 11 — Hermes Agent adapter (sidecar)

## Goal

Optional [Hermes Agent](https://github.com/NousResearch/hermes-agent) engine behind the existing CodeForge chat SSE contract.

## Scope (Phase 1)

- User preference `agent_engine`: `codeforge` | `hermes`
- `GET /api/v1/hermes/status` — binary, env gate, effective engine
- `hermes_adapter.py` — subprocess or simulate bridge → `run_started`, `token`, `tool_call`, `tool_result`, `complete`
- Session stream branches on preference; falls back to CodeForge when Hermes is unavailable
- Web + desktop settings toggle (Token Saver tab)
- Env: `CODEFORGE_HERMES_ENABLED`, `CODEFORGE_HERMES_BINARY`, `CODEFORGE_HERMES_SIMULATE`, `HERMES_HOME`

## Operator setup

1. Install Hermes on the API host (`pip install hermes-agent` or clone + `./hermes`).
2. Run `hermes setup` and configure provider keys in `~/.hermes` or `HERMES_HOME`.
3. Set on the API service:
   - `CODEFORGE_HERMES_ENABLED=true`
   - Optional `CODEFORGE_HERMES_BINARY=/path/to/hermes`
   - Optional `CODEFORGE_HERMES_EXTRA_ARGS` (extra CLI flags)
4. Users choose **Hermes** under Settings → Token Saver → Agent engine.

## Dev / CI without Hermes

Set `CODEFORGE_HERMES_ENABLED=true` and `CODEFORGE_HERMES_SIMULATE=true` to exercise the SSE bridge without a real binary.

## Out of scope (later phases)

- Proposal/diff parity with CodeForge engine
- Shared tool gateway / MCP unification
- Hermes gateway (Telegram, Slack) wired to CodeForge sessions
- In-process Python import of `AIAgent` (avoids heavy deps in API image for now)

## Verification

```bash
cd services/api
pytest tests/test_hermes_adapter.py -q
```
