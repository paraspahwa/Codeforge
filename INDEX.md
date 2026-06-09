# CodeForge Spec Index

## Reading Order

1. Start with [PRD.md](PRD.md) for the product definition and roadmap.
2. Read [docs/implementation-plan.md](docs/implementation-plan.md) for the phased execution plan.
3. Use [docs/tickets/README.md](docs/tickets/README.md) for implementation tickets and build order.
4. Use this file as a pointer map when handing tasks to GitHub Copilot.

## Primary Documents

- [PRD.md](PRD.md): product scope, phases, and success metrics
- [docs/implementation-plan.md](docs/implementation-plan.md): execution plan and delivery order
- [docs/tickets/README.md](docs/tickets/README.md): ticket backlog and phase slices
- [README.md](README.md): repo setup and current implementation status

## Suggested Copilot Prompts

### Backend Foundation

Build the shared FastAPI backend slice from `docs/tickets/phase-0-foundation.md`, keeping the current session model and streaming events intact.

### Code Mode Core

Implement the file operations, diff preview, approval, and apply flow from `docs/tickets/phase-1-code-mode.md`.

### Terminal Parity

Extend the Ink terminal client according to `docs/tickets/phase-1-terminal.md` so it can render approvals, diffs, and session history.

### Platform Surfaces

Improve the web and desktop clients from `docs/tickets/phase-2-platform-surface.md` and keep them on the shared API contract.

## Current Technical Direction

- Backend: FastAPI + Python 3.13
- Web: Next.js + React
- Desktop: Tauri + React
- Terminal: Ink + React
- Shared package: browser/node API helpers and SSE parsing

## Backlog Areas (active)

- Execute Terraform two-phase apply: [infra/terraform/README.md](infra/terraform/README.md) (`enable_ecs_services` + optional `enable_qdrant_service`)
- Set GitHub vars: `DEPLOY_QDRANT_SERVICE=true` after Qdrant ECS service exists; `VERIFY_OIDC_CUTOVER=true` after OIDC flip
- Bootstrap SSM: Razorpay, OIDC, Qdrant — then OIDC cutover with `patch_ecs_oidc_enabled.py`

Operator runbook: [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)

## Recently shipped (client SSO + Qdrant CI batch)

- Qdrant deploy in `deploy-ecs.yml` when `DEPLOY_QDRANT_SERVICE=true` (registers `taskdef-qdrant.json`)
- Terminal + VS Code SSO-only UI when OIDC enabled; admin-only delegation step approval
- Post-deploy `VERIFY_OIDC_CUTOVER` gate; verify script skips when OIDC off

## Recently shipped (OIDC lockdown + Qdrant terraform batch)

- Dev-login disabled when OIDC enabled; `CODEFORGE_ALLOW_DEV_LOGIN` for CI smoke only
- Web/desktop hide dev-login UI when SSO is on; deploy-readiness `dev_login_disabled_under_oidc`
- Qdrant Terraform: `ecs-qdrant-service` + `qdrant-access`, `taskdef-qdrant.json`, Cloud Map URL output
- `scripts/verify_oidc_cutover_readiness.py` for post-cutover OIDC validation

## Recently shipped (infra handoff + data plane batch)

- Terraform two-phase runbook in `infra/terraform/README.md`
- OIDC SSM bootstrap fix: production prefix `codeforge/prod` (matches ECS taskdefs)
- Qdrant: `bootstrap_qdrant_ssm.py`, `docs/qdrant-ecs-setup.md`, deploy-readiness `qdrant_url` + `probe_vector`
- Vector collection uses 1536 dims when `OPENAI_API_KEY` is set (`QDRANT_VECTOR_SIZE` override)
- `patch_ecs_oidc_enabled.py`; `DEPLOYMENT_RUNBOOK.md` synced to committed assets

## Recently shipped (go-live ops batch)

- Deploy readiness: Razorpay keys, Supabase JWT (OIDC off), public web URL, `probe_billing` + `billing_webhook_url`
- `scripts/bootstrap_razorpay_ssm.py`, `.env.razorpay.example`, [docs/razorpay-webhook-setup.md](docs/razorpay-webhook-setup.md)
- CI: `api-tests` pytest job, billing webhook smoke gate, post-deploy `post_deploy_public_smoke.sh` on ECS deploy

## Recently shipped (production terraform + billing hardening batch)

- Production Terraform env: `infra/terraform/environments/production/` (mirrors staging; service names match `deploy-ecs.yml`)
- ECS service name variables aligned with CI (`codeforge-api-staging-service`, `codeforge-api-service`, etc.)
- Billing: `razorpay_subscription_id` on subscriptions, stable webhook event ids, verify-payment order validation
- `scripts/patch_ecs_worker_efs.py` replaces inline EFS patch in deploy workflow

## Recently shipped (worker EFS + renewal batch)

- Worker Terraform: `modules/ecs-worker-service` + `modules/efs-access` (NFS 2049 from worker tasks)
- Staging `worker.tf` wires worker service + EFS security when `efs_file_system_id` is set
- Razorpay renewal webhooks re-activate subscriptions and re-sync owned org plans (`subscription.charged`, etc.)

## Recently shipped (lapse + ECS terraform batch)

- Razorpay lapse webhooks (`subscription.cancelled`, `subscription.halted`, etc.) deactivate subscriptions and downgrade owned orgs to `lite`
- `payment.failed` marks billing orders as `failed`
- Terraform `modules/ecs-service` wires Fargate services to ALB target groups (`enable_ecs_services` in staging)

## Recently shipped (webhook + terraform batch)

- Razorpay webhook processes `payment.captured` / `order.paid` and syncs subscriptions + org plan upgrades
- `billing_orders.org_id` persisted at checkout; shared `billing_service.apply_verified_payment`
- Terraform ALB/TLS skeleton: `infra/terraform/modules/edge` + staging environment example

## Recently shipped (org billing + domains batch)

- `POST /api/v1/orgs/{org_id}/plan` and payment verify `org_id` upgrade org `plan_id` for members
- Web billing org selector applies subscription tier to an organization at checkout
- `scripts/patch_ecs_public_urls.py` + deploy workflow patches for `CODEFORGE_WEB_BASE_URL` / `NEXT_PUBLIC_API_BASE`
- [docs/production-domains.md](docs/production-domains.md) TLS/DNS runbook

## Recently shipped (billing + IdP batch)

- `GET /api/v1/billing/context` — effective plan from org membership vs personal subscription
- Web billing page shows org plans, effective source, and usage limits
- `scripts/bootstrap_oidc_ssm.py` + `.env.oidc.example` + [docs/oidc-idp-checklist.md](docs/oidc-idp-checklist.md)

## Recently shipped (production ops batch)

- `GET /api/v1/platform/deploy-readiness` (+ optional `probe_discovery`) for OIDC/config preflight
- CI deploy-readiness gate in `.github/workflows/deploy-ecs.yml`
- Worker deploy: auto-create `codeforge-worker` ECR repo + inject EFS filesystem id from GitHub variables
- Web Team page: organizations, workspace-org linking, and session grants admin

## Recently shipped (engineering batch)

- MCP HTTP JSON-RPC transport for remote connector `tools/call` (`services/api/app/mcp_transport.py`)
- Billing org entities (`/api/v1/orgs`) with workspace linkage and plan-aware usage policy
- Workspace session grants (`/api/v1/team/workspaces/{id}/session-grants`) for delegated cross-member session access
- Terminal `/sso` and VS Code panel SSO (authorize URL + code paste completion)
- Desktop + terminal + VS Code style guide create/update parity

## Notes

The current repo intentionally tracks the roadmap in docs first. The tickets under `docs/tickets/` are the build queue for Copilot or a human implementer.
