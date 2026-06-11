# CodeForge — Production deployment checklist

Step-by-step guide to go live in the **cheapest practical way**, with optional split hosting (Vercel + Supabase + Cloudflare) or a single VPS.

See also: [DEPLOYMENT_RUNBOOK.md](../DEPLOYMENT_RUNBOOK.md), [deployment-assets-setup.md](deployment-assets-setup.md), [.env.production.template](../.env.production.template).

---

## 1. What you are deploying

| Component | Technology | Can run on Vercel? |
|-----------|------------|--------------------|
| Web | Next.js (`apps/web`) | **Yes** |
| API | FastAPI (`services/api`) | **No** — needs always-on container |
| Worker | Celery + Playwright (`Dockerfile.worker`) | **No** |
| Postgres | Supabase or compose `db` | Supabase **Yes** |
| Redis | Upstash or compose `redis` | Upstash **Yes** |
| Qdrant | Qdrant Cloud or compose `qdrant` | Qdrant Cloud **Yes** |
| Desktop / Terminal / VS Code | Local clients | N/A |

The API handles SSE streaming, git/shell sandboxes, file ops, and billing webhooks. It cannot be replaced by Vercel serverless functions alone.

---

## 2. Choose a deployment path

### Path A — Cheapest full stack (~$5–12/mo) **recommended to start**

One VPS (2GB+ RAM: Hetzner, DigitalOcean, etc.) + **Cloudflare** (free DNS/SSL).

```bash
git clone <repo>
cd Indi-claude
cp .env.production.template .env
# Edit .env — fill all CHANGE_ME values
docker compose -f docker-compose.prod.yml up -d --build
```

Point Cloudflare DNS `A` records for `api.` and `app.` (or one host) to the VPS IP. Use Nginx or expose ports 3000/8000 behind Cloudflare proxy.

### Path B — Split managed services (~$0–25/mo)

| Piece | Provider | Notes |
|-------|----------|-------|
| Web | **Vercel** | Set `NEXT_PUBLIC_API_BASE=https://api.yourdomain.com` at build time |
| Postgres | **Supabase** | `DATABASE_URL` with `?sslmode=require`; run `alembic upgrade head` |
| Redis | **Upstash** | `REDIS_URL` + same host for `CELERY_BROKER_URL` db `/1` |
| Qdrant | **Qdrant Cloud** | Free tier cluster → `QDRANT_URL` |
| API + Worker | **Railway / Render / Fly.io** | Deploy Docker images; attach volume for `/workspaces` |
| DNS/TLS | **Cloudflare** | `app` → Vercel, `api` → Railway |

Limitations: Playwright worker is heavy on free tiers; you may set `CODEFORGE_DISABLE_PLAYWRIGHT=true` and skip browser cowork until you scale up.

### Path C — AWS ECS (repo CI default, ~$50–150+/mo)

Use when you need multi-AZ, EFS, and GitHub Actions deploy. See [deployment-assets-setup.md](deployment-assets-setup.md).

---

## 3. Production readiness requirements

Set `CODEFORGE_ENV=production`. The API exposes a live checklist:

```bash
curl -s https://api.yourdomain.com/api/v1/platform/deploy-readiness | jq
curl -s https://api.yourdomain.com/api/v1/platform/stack-status | jq
```

### Required for `ready: true` in production

| Check | Variable(s) |
|-------|-------------|
| Database | `DATABASE_URL` or `PGHOST` + `PGPASSWORD` |
| Task queue | `REDIS_URL` or `CELERY_BROKER_URL` |
| Vector store | `QDRANT_URL` |
| Auth (no OIDC) | `SUPABASE_JWT_SECRET` |
| Billing | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Public web URL | `CODEFORGE_WEB_BASE_URL` (not localhost) |

### Strongly recommended

| Item | Action |
|------|--------|
| Disable dev login | `CODEFORGE_ALLOW_DEV_LOGIN=false` |
| Real LLM | `OPENAI_API_KEY` (+ optional Azure for prod gate) |
| CORS | `CODEFORGE_CORS_ORIGINS=https://app.yourdomain.com` |
| Worker | Run `Dockerfile.worker`; set `CODEFORGE_COWORK_SCHEDULER_ENABLED=false` on API |
| Razorpay webhook | Register `https://api.yourdomain.com/api/v1/billing/webhook` |

### Optional probes

```bash
curl "https://api.yourdomain.com/api/v1/platform/deploy-readiness?probe_discovery=true"
curl "https://api.yourdomain.com/api/v1/platform/deploy-readiness?probe_billing=true"
curl "https://api.yourdomain.com/api/v1/platform/deploy-readiness?probe_vector=true"
```

---

## 4. Secrets and API keys — complete list

### Infrastructure (required)

| Variable | Where to get it |
|----------|-----------------|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (pooler) |
| `POSTGRES_PASSWORD` | Compose-only; Supabase uses URL password |
| `REDIS_URL` | Upstash Redis → REST/Redis URL (`redis://...`) |
| `CELERY_BROKER_URL` | Same Redis, database index `/1` |
| `CELERY_RESULT_BACKEND` | Same as broker or `/1` |
| `QDRANT_URL` | [Qdrant Cloud](https://cloud.qdrant.io) or self-hosted |

### Auth (pick one)

**Private staging / solo beta**

```env
CODEFORGE_ALLOW_DEV_LOGIN=true
```

**Production SSO (recommended)**

```env
CODEFORGE_OIDC_ENABLED=true
CODEFORGE_OIDC_ISSUER=https://your-idp.example.com
CODEFORGE_OIDC_CLIENT_ID=
CODEFORGE_OIDC_CLIENT_SECRET=
CODEFORGE_OIDC_REDIRECT_URI=https://app.yourdomain.com/auth/callback
CODEFORGE_OIDC_JWKS_URI=
CODEFORGE_OIDC_AUDIENCE=codeforge-api
CODEFORGE_ALLOW_DEV_LOGIN=false
```

Copy [.env.oidc.example](../.env.oidc.example) and run `python scripts/bootstrap_oidc_ssm.py` for AWS SSM.

**Supabase JWT** (if you issue Supabase Auth tokens to the API):

```env
SUPABASE_JWT_SECRET=<from Supabase Dashboard → Settings → API → JWT Secret>
```

The web app does not ship Supabase Auth UI today; OIDC or dev-login are the primary paths.

### Billing (India — Razorpay)

| Variable | Where |
|----------|-------|
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → API Keys |
| `RAZORPAY_KEY_SECRET` | Same |

Use test keys first. Webhook URL: `https://api.yourdomain.com/api/v1/billing/webhook`.

See [.env.razorpay.example](../.env.razorpay.example).

### LLM / AI

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `OPENAI_API_KEY` | Chat synthesis, embeddings, scrape, vision OCR | **Yes** for real AI |
| `OPENAI_BASE_URL` | OpenAI-compatible gateway (default OpenAI) | Optional |
| `CODEFORGE_SYNTHESIS_MODEL` | e.g. `gpt-4o-mini` | Recommended |
| `CODEFORGE_EMBEDDING_MODEL` | e.g. `text-embedding-3-small` | For real vector search |
| `CODEFORGE_VISION_MODEL` | Browser screenshot OCR | Optional |
| `CODEFORGE_SYNTHESIS_PROVIDER` | `openai`, `azure_openai`, or `auto` | Staging: `openai` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI | Prod CI gate |
| `AZURE_OPENAI_API_KEY` | Azure | Prod CI gate |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name | Prod CI gate |
| `AZURE_OPENAI_API_VERSION` | e.g. `2024-10-21` | Optional |
| `DEEPSEEK_API_KEY` | LiteLLM DeepSeek routes | Optional |
| `ANTHROPIC_API_KEY` | LiteLLM Claude fallback tiers | Optional |

Without provider keys, the API returns **deterministic fallback** text (good for smoke tests, not production UX).

### Optional product features

| Variable | Feature |
|----------|---------|
| `SUPERMEMORY_CC_API_KEY` | Supermemory BYOK |
| `CODEFORGE_SCRAPE_ENABLED` | ScrapeGraphAI cowork |
| `CODEFORGE_RTK_ENABLED` | Shell output compression |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry traces |

### Public URLs (must match your DNS)

| Variable | Example |
|----------|---------|
| `CODEFORGE_WEB_BASE_URL` | `https://app.yourdomain.com` |
| `CODEFORGE_PUBLIC_API_BASE` | `https://api.yourdomain.com` |
| `CODEFORGE_CORS_ORIGINS` | `https://app.yourdomain.com` |
| `NEXT_PUBLIC_API_BASE` | `https://api.yourdomain.com` (Vercel **build** env) |

### Client-only (not on API server)

| Variable | Client |
|----------|--------|
| `VITE_CODEFORGE_API_BASE_URL` | Desktop |
| `VITE_CODEFORGE_WEB_BASE_URL` | Desktop billing link |
| `CODEFORGE_API_BASE_URL` | Terminal / VS Code |

---

## 5. Your checklist (copy and tick off)

### Phase 0 — Local smoke (free)

- [ ] `cp .env.example .env.local` and fill OpenAI key for real chat
- [ ] `docker compose -f docker-compose.prod.yml up --build`
- [ ] Open http://localhost:3000 — dev login, create session, send message
- [ ] `curl http://localhost:8000/api/v1/platform/deploy-readiness`

### Phase 1 — Domains and DNS (Cloudflare)

- [ ] Register domain
- [ ] Add site to Cloudflare (free plan)
- [ ] Create records: `app` → Vercel or VPS, `api` → API host
- [ ] Enable proxy (orange cloud) for HTTPS

### Phase 2 — Data layer

- [ ] Create Supabase project → copy `DATABASE_URL`
- [ ] Run migrations: `cd services/api && alembic upgrade head`
- [ ] Create Upstash Redis → `REDIS_URL`
- [ ] Create Qdrant Cloud cluster → `QDRANT_URL`

### Phase 3 — API + worker

- [ ] Copy `.env.production.template` → `.env`
- [ ] Set `CODEFORGE_ENV=production`
- [ ] Set all required secrets (section 4)
- [ ] Deploy API container (compose VPS or Railway)
- [ ] Deploy worker container (`Dockerfile.worker`)
- [ ] Set `CODEFORGE_COWORK_SCHEDULER_ENABLED=false` on API only
- [ ] Mount workspace volume: `CODEFORGE_HOST_WORKSPACES`

### Phase 4 — Web (Vercel)

- [ ] Import repo; root directory `apps/web` or monorepo build per Vercel docs
- [ ] Build env: `NEXT_PUBLIC_API_BASE=https://api.yourdomain.com`
- [ ] Deploy; confirm chat calls API without CORS errors

### Phase 5 — Billing (optional)

- [ ] Razorpay test keys in `.env`
- [ ] Register webhook URL on Razorpay
- [ ] Test checkout on `/billing`
- [ ] Switch to live keys when ready

### Phase 6 — Auth hardening

- [ ] Set `CODEFORGE_ALLOW_DEV_LOGIN=false`
- [ ] Enable OIDC OR wire Supabase Auth + `SUPABASE_JWT_SECRET`
- [ ] Register redirect URIs at IdP (web, desktop, terminal, VS Code — see DEPLOYMENT_RUNBOOK)

### Phase 7 — Verify production

- [ ] `GET /health` → `{"status":"ok"}`
- [ ] `GET /api/v1/platform/deploy-readiness` → `"ready": true`
- [ ] `GET /api/v1/platform/stack-status` → redis/qdrant/task_queue healthy
- [ ] Enqueue cowork job or `POST /api/v1/platform/queue-ping` → worker responds
- [ ] Synthesis: `GET /api/v1/evals/synthesis-rollout/validation?environment=production`

---

## 6. Vercel-specific notes

1. **Only deploy `apps/web`** to Vercel.
2. Set `NEXT_PUBLIC_API_BASE` in Vercel project → Settings → Environment Variables (Production).
3. API must be reachable from the browser (public HTTPS, valid CORS).
4. Rebuild web after changing API URL.

---

## 7. Supabase-specific notes

1. Use the **connection pooler** URI for serverless-friendly API deploys.
2. Append `?sslmode=require` if not present.
3. `SUPABASE_JWT_SECRET` validates JWTs if you integrate Supabase Auth; it is required by deploy-readiness when OIDC is off and `CODEFORGE_ENV=production`.
4. Run Alembic against Supabase before first API start.

---

## 8. Cost estimate (monthly, USD)

| Stack | Infra | Notes |
|-------|-------|-------|
| VPS + Cloudflare | $5–12 | + OpenAI usage |
| Vercel + Supabase + Upstash + Qdrant free + Railway $5 | $0–20 | + OpenAI usage |
| AWS ECS | $50–150+ | Enterprise path |

OpenAI is usually the largest variable cost (chat, embeddings, scrape, vision).

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `deploy-readiness` not ready | Read `checks[]` in JSON; fill missing env vars |
| CORS error in browser | Set `CODEFORGE_CORS_ORIGINS` to exact web origin |
| Web calls wrong API | Rebuild with correct `NEXT_PUBLIC_API_BASE` |
| Deterministic / stub chat | Set `OPENAI_API_KEY` |
| Memory search weak | Set `QDRANT_URL` + `OPENAI_API_KEY` for real embeddings |
| Cowork jobs stuck | Start worker; check `REDIS_URL` and worker logs |
| Billing webhook fails | Match `RAZORPAY_KEY_SECRET`; use public API URL |

---

## 10. Related scripts

| Script | Purpose |
|--------|---------|
| `scripts/bootstrap_oidc_ssm.py` | Push OIDC secrets to AWS SSM |
| `scripts/bootstrap_razorpay_ssm.py` | Push Razorpay secrets to SSM |
| `scripts/bootstrap_qdrant_ssm.py` | Push Qdrant URL to SSM |
| `scripts/patch_ecs_worker_efs.py` | Inject EFS id into worker taskdefs |
