# CodeForge API Reference

Concise index of public HTTP endpoints. For request/response schemas, use the live OpenAPI UI:

- `GET /docs` — Swagger UI
- `GET /redoc` — ReDoc

**Auth:** Most routes require `Authorization: Bearer <access_token>`. Obtain a token via dev-login (`POST /api/v1/auth/dev-login`) or OIDC (`/api/v1/auth/oidc/*`). Platform health routes (`/health`, `/api/v1/platform/*`) accept unauthenticated requests.

**Client SDK:** `packages/shared/src/api.js` wraps these endpoints for web, desktop, terminal, and VS Code.

---

## Auth

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/auth/dev-login` | Local dev token (disabled when OIDC on) |
| `GET` | `/api/v1/auth/oidc/config` | OIDC client config for web/desktop |
| `GET` | `/api/v1/auth/oidc/authorize-url` | Build IdP authorize URL |
| `POST` | `/api/v1/auth/oidc/callback` | Exchange auth code for token |
| `POST` | `/api/v1/auth/oidc/exchange` | Token exchange (desktop/terminal paste flow) |
| `GET` | `/api/v1/auth/oidc/discovery` | IdP discovery metadata |

See [oidc-idp-checklist.md](oidc-idp-checklist.md).

---

## Sessions and streaming

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/sessions` | Create session |
| `GET` | `/api/v1/sessions` | List sessions |
| `POST` | `/api/v1/sessions/{id}/fork` | Fork session |
| `GET` | `/api/v1/sessions/{id}/messages` | Message history |
| `POST` | `/api/v1/sessions/{id}/messages` | Send user message |
| `GET` | `/api/v1/sessions/{id}/stream` | **SSE** agent stream |

The stream endpoint composes context from project knowledge, taste rules, agent memory, Supermemory (if configured), and enabled skills before synthesis. See [phase-7-taste.md](tickets/phase-7-taste.md), [phase-8-memory.md](tickets/phase-8-memory.md), [phase-10-anthropic-skills.md](tickets/phase-10-anthropic-skills.md).

---

## Proposals and file ops

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/sessions/{id}/proposals` | List agent proposals |
| `GET` | `/api/v1/sessions/{id}/proposals/{pid}` | Proposal detail |
| `POST` | `/api/v1/sessions/{id}/proposals/{pid}/decision` | Approve/reject/edit — **feeds taste learning** |
| `GET` | `/api/v1/sessions/{id}/files/preview` | Diff preview |
| `GET` | `/api/v1/sessions/{id}/files/content` | Read file |
| `POST` | `/api/v1/sessions/{id}/files/apply` | Apply approved diff |

Proposal decision body accepts `action` (`approve` \| `reject`), optional `note` (preference text), and optional `edited_content` (user-edited apply payload).

---

## Code mode — git, shell, workflows

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/sessions/{id}/git/status` | Git status |
| `GET` | `/api/v1/sessions/{id}/git/diff` | File diff |
| `GET` | `/api/v1/sessions/{id}/git/log` | Recent commits |
| `POST` | `/api/v1/sessions/{id}/git/stage` | Stage files |
| `POST` | `/api/v1/sessions/{id}/git/commit` | Commit |
| `POST` | `/api/v1/sessions/{id}/git/branch` | Create/switch branch |
| `GET` | `/api/v1/sessions/{id}/git/worktree/list` | List worktrees |
| `POST` | `/api/v1/sessions/{id}/git/worktree/create` | Create worktree |
| `GET` | `/api/v1/sessions/{id}/git/merge-assist` | Merge guidance |
| `GET` | `/api/v1/sessions/{id}/git/conflict-guide` | Conflict resolution guide |
| `POST` | `/api/v1/sessions/{id}/git/conflict-assist/apply` | Apply conflict resolution |
| `POST` | `/api/v1/sessions/{id}/shell/stream` | **SSE** shell output (RTK-compressed when enabled) |
| `POST` | `/api/v1/sessions/{id}/workflows/compact` | Compact session context |
| `POST` | `/api/v1/sessions/{id}/workflows/ultrareview` | Multi-pass review |
| `POST` | `/api/v1/sessions/{id}/workflows/plan` | Create change plan |
| `POST` | `/api/v1/sessions/{id}/workflows/plan/{pid}/execute` | Execute plan |
| `POST` | `/api/v1/sessions/{id}/workflows/plan/{pid}/rollback` | Rollback plan |
| `POST` | `/api/v1/sessions/{id}/agent/loop` | Agent coding loop |

---

## Taste (Phase 7)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/taste/rules` | Active rules + rendered `taste.md` |
| `GET` | `/api/v1/taste/stats` | Approval/rejection metrics |
| `GET` | `/api/v1/taste/export` | Export taste pack |
| `POST` | `/api/v1/taste/import` | Import taste pack |

Primary input path: proposal decisions with `note` or `edited_content` distill into `taste_rules`. Team workspace style guides merge via `compose_taste_context`.

---

## Agent preferences, skills, RTK (Phases 7–10)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/skills` | List bundled + project skills |
| `GET` | `/api/v1/skills/{name}` | Skill detail (full body, license, source) |
| `GET` | `/api/v1/agent/preferences` | User prefs (`caveman_mode`, `enabled_skills`, `rtk_enabled`) |
| `PUT` | `/api/v1/agent/preferences` | Update prefs — validates skill names |
| `GET` | `/api/v1/rtk/status` | RTK binary availability and effective enablement |

RTK toggle: `PUT /api/v1/agent/preferences` with `{ "rtk_enabled": true }`. Global override: `CODEFORGE_RTK_ENABLED=true`.

---

## Memory (Phase 8)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/memory` | List memories (`scope`, `project_path` query) |
| `GET` | `/api/v1/memory/search` | Semantic search |
| `POST` | `/api/v1/memory` | Save memory (`scope`: `personal` \| `team`; `kind`: `note` \| `bug` \| `architecture` \| `decision`) |
| `GET` | `/api/v1/memory/export` | Export memory pack |
| `GET` | `/api/v1/supermemory/status` | Supermemory BYOK status |
| `GET` | `/api/v1/supermemory/search` | Search Supermemory |
| `POST` | `/api/v1/supermemory/save` | Save to Supermemory |

Auto-capture triggers: `/workflows/compact`, approved proposals with architectural notes, scrape ingest.

---

## Cowork (Phase 4 + 9)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/cowork/plans` | Create plan (`task_type`: `shell` \| `extract` \| `browser` \| `connector` \| `scrape`) |
| `GET` | `/api/v1/cowork/plans` | List plans |
| `POST` | `/api/v1/cowork/plans/{id}/run` | Run plan (requires `approved: true`) |
| `GET` | `/api/v1/cowork/runs` | Run history |
| `POST` | `/api/v1/cowork/jobs` | Scheduled job (`shell` \| `extract` only — scrape not schedulable) |
| `GET` | `/api/v1/cowork/jobs` | List jobs |
| `POST` | `/api/v1/cowork/jobs/{id}/toggle` | Enable/disable job |
| `POST` | `/api/v1/cowork/extract` | Workspace OCR/extraction |
| `GET` | `/api/v1/cowork/extract` | Extraction history |
| `POST` | `/api/v1/cowork/scrape` | ScrapeGraphAI extraction → knowledge + memory |
| `GET` | `/api/v1/cowork/reliability` | Reliability summary |
| `GET` | `/api/v1/cowork/reliability/history` | Reliability history |

Scrape requires `CODEFORGE_SCRAPE_ENABLED=true`, `OPENAI_API_KEY`, and `approved: true` for ingestion. See [phase-9-scrape.md](tickets/phase-9-scrape.md).

---

## Team and orgs

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/orgs` | Create organization |
| `GET` | `/api/v1/orgs` | List orgs |
| `POST` | `/api/v1/orgs/{id}/members` | Add member |
| `POST` | `/api/v1/orgs/{id}/plan` | Set org plan |
| `POST` | `/api/v1/team/workspaces` | Create workspace |
| `GET` | `/api/v1/team/workspaces` | List workspaces |
| `POST` | `/api/v1/team/workspaces/{id}/members` | Add workspace member |
| `POST` | `/api/v1/team/workspaces/{id}/org` | Link workspace to org |
| `POST` | `/api/v1/team/workspaces/{id}/session-grants` | Grant session access |
| `GET` | `/api/v1/team/workspaces/{id}/session-grants` | List grants |
| `POST` | `/api/v1/team/session-share` | Create share link |
| `GET` | `/api/v1/team/session-share/{id}` | Resolve share |
| `GET` | `/api/v1/team/session-export/{id}` | Export session |
| `POST` | `/api/v1/team/delegations` | Create delegation |
| `GET` | `/api/v1/team/delegations` | List delegations |
| `POST` | `/api/v1/team/delegations/{id}/execute` | Execute delegation |
| `POST` | `/api/v1/team/delegations/{id}/approve-step` | Approve delegation step |
| `GET` | `/api/v1/team/audit-log` | Audit log |
| `POST` | `/api/v1/team/workspaces/{id}/style-guides` | Create style guide |
| `GET` | `/api/v1/team/workspaces/{id}/style-guides` | List style guides |
| `PUT` | `/api/v1/team/workspaces/{id}/style-guides/{gid}` | Update style guide |
| `GET` | `/api/v1/team/events` | **SSE** team events |

---

## Projects, context, MCP

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/projects/knowledge/rebuild` | Rebuild project knowledge index |
| `POST` | `/api/v1/projects/knowledge/upload` | Upload knowledge files |
| `GET` | `/api/v1/projects/knowledge` | Knowledge status |
| `POST` | `/api/v1/projects/knowledge/query` | RAG query |
| `POST` | `/api/v1/context/packs` | Create context pack |
| `GET` | `/api/v1/context/packs` | List packs |
| `POST` | `/api/v1/context/attach` | Attach pack to session |
| `GET` | `/api/v1/context/session/{id}` | Session context composition |
| `POST` | `/api/v1/mcp/connectors` | Register MCP connector |
| `GET` | `/api/v1/mcp/connectors` | List connectors |
| `POST` | `/api/v1/mcp/connectors/{id}/toggle` | Enable/disable connector |
| `POST` | `/api/v1/mcp/connectors/{id}/invoke` | Invoke MCP tool |

---

## Billing and usage

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/usage/summary` | Usage limits and consumption |
| `GET` | `/api/v1/billing/plans` | Available plans |
| `GET` | `/api/v1/billing/context` | Effective plan (org vs personal) |
| `GET` | `/api/v1/billing/subscription` | Subscription status |
| `POST` | `/api/v1/billing/create-order` | Razorpay checkout order |
| `POST` | `/api/v1/billing/verify-payment` | Verify payment signature |
| `POST` | `/api/v1/billing/webhook` | Razorpay webhook (HMAC, no user auth) |

See [razorpay-webhook-setup.md](razorpay-webhook-setup.md).

---

## Evals and deploy gates

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/evals/routing-benchmark` | Routing benchmark |
| `GET` | `/api/v1/evals/routing-benchmark/baseline` | Routing baseline |
| `POST` | `/api/v1/evals/routing-benchmark/baseline` | Set routing baseline |
| `GET` | `/api/v1/evals/routing-benchmark/trends` | Routing trends |
| `GET` | `/api/v1/evals/quality-benchmark` | Quality benchmark |
| `GET` | `/api/v1/evals/quality-benchmark/baseline` | Quality baseline |
| `POST` | `/api/v1/evals/quality-benchmark/baseline` | Set quality baseline |
| `GET` | `/api/v1/evals/quality-benchmark/trends` | Quality trends |
| `GET` | `/api/v1/evals/synthesis-rollout` | Synthesis provider status |
| `GET` | `/api/v1/deploy/synthesis-rollout-plan` | Rollout plan for environment |
| `GET` | `/api/v1/deploy/synthesis-rollout-validate` | **CI production gate** |

Production validation:

```bash
curl -s "https://api.yourdomain.com/api/v1/deploy/synthesis-rollout-validate?environment=production" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Platform ops (no auth required)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness |
| `GET` | `/api/v1/platform/stack-status` | Redis, Qdrant, Celery, generation backends |
| `GET` | `/api/v1/platform/deploy-readiness` | Production config checklist |
| `POST` | `/api/v1/platform/queue-ping` | Enqueue worker smoke job |
| `GET` | `/api/v1/platform/queue-ping/{job_id}` | Poll queue-ping result |

Optional deploy-readiness probes: `?probe_discovery=true`, `?probe_billing=true`, `?probe_vector=true`.

RTK, scrape, Supermemory, and skills are **not** included in deploy-readiness — verify via feature-specific endpoints above.

---

## Remote channels and artifacts

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/remote/channels` | Create remote channel |
| `GET` | `/api/v1/remote/channels` | List channels |
| `POST` | `/api/v1/remote/channels/pair` | Pair channel |
| `POST` | `/api/v1/remote/channels/{id}/push` | Push event |
| `GET` | `/api/v1/remote/channels/{id}/events` | **SSE** channel events |
| `GET` | `/api/v1/sessions/{id}/artifacts` | List session artifacts |
| `POST` | `/api/v1/sessions/{id}/artifacts` | Create artifact |
| `GET` | `/api/v1/sessions/{id}/artifacts/{aid}` | Artifact metadata |
| `GET` | `/api/v1/sessions/{id}/artifacts/{aid}/preview` | Artifact preview |
| `POST` | `/api/v1/agent/templates` | Create agent template |
| `GET` | `/api/v1/agent/templates` | List templates |
| `DELETE` | `/api/v1/agent/templates/{id}` | Delete template |
| `POST` | `/api/v1/agent/templates/{id}/compose` | Compose from template |

---

## Related docs

| Topic | Document |
|-------|----------|
| Local smoke + feature verification | [DEPLOYMENT_RUNBOOK.md](../DEPLOYMENT_RUNBOOK.md) |
| Production go-live | [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md) |
| Taste + skills | [tickets/phase-7-taste.md](tickets/phase-7-taste.md), [tickets/phase-10-anthropic-skills.md](tickets/phase-10-anthropic-skills.md) |
| RTK + memory | [tickets/phase-8-memory.md](tickets/phase-8-memory.md) |
| Scrape | [tickets/phase-9-scrape.md](tickets/phase-9-scrape.md) |
| Client SDK | [packages/shared/README.md](../packages/shared/README.md) |
