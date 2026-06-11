# CodeForge Deployment & Testing Runbook

Step-by-step guide to run CodeForge **locally** and on an **AWS Linux machine**, then verify what is working and what is not.

Use this runbook when you want to smoke-test the full platform before or after a cloud deploy.

---

## 1. What you are running

| Component | Path | Hosted on AWS? |
|-----------|------|----------------|
| API (FastAPI) | `services/api` | Yes — ECS Fargate or EC2 |
| Web (Next.js) | `apps/web` | Yes — ECS Fargate or EC2 |
| Worker (Celery + Playwright) | `services/api/Dockerfile.worker` | Yes — ECS worker service |
| PostgreSQL | via `DATABASE_URL` or compose `db` | Yes — RDS or compose |
| Redis + Qdrant | compose / ECS sidecars | Yes — ElastiCache / ECS Qdrant |
| Desktop (Tauri) | `apps/desktop` | No — client only |
| Terminal (Ink) | `apps/terminal` | No — client only |
| VS Code extension | `apps/vscode` | No — client only |

**Recommended testing order:** API → Web → automated smoke gates → optional clients (terminal, desktop, VS Code).

---

## 2. Choose a path

| Path | Best for | Full stack? | Worker/Cowork? |
|------|----------|-------------|----------------|
| **A — Native local dev** | Fast iteration on API/web code | Partial (SQLite, in-memory fallbacks) | No |
| **B — Docker Compose** | Production-like testing on any OS | Yes (Postgres, Redis, Qdrant, worker) | Yes |
| **C — AWS EC2 Linux** | Staging / manual cloud testing | Yes (same compose stack) | Yes |
| **D — AWS ECS** | Real staging/production | Yes | Yes (needs EFS + SSM) |

---

## 3. Prerequisites

### 3.1 All paths

- Git
- Node.js 20 LTS + npm
- Python 3.13 (native API path only)
- Docker + Docker Compose v2 (paths B and C)

### 3.2 Optional clients

| Client | Extra requirement |
|--------|-------------------|
| Desktop | Rust toolchain (`rustup`) for Tauri |
| VS Code extension | VS Code with F5 Extension Development Host |

### 3.3 AWS EC2 (path C)

- EC2 instance: **Amazon Linux 2023** or **Ubuntu 24.04**, `t3.medium` or larger (worker + Playwright is heavy)
- Security group inbound: `22` (SSH), `8000` (API), `3000` (web) — or `80`/`443` if using Nginx
- Elastic IP recommended if you need a stable URL for webhooks/OIDC callbacks

---

## 4. Path A — Native local development

Use this for quick API/web work. The API falls back to **SQLite** when `DATABASE_URL` is unset, and Redis/Qdrant/worker features degrade to in-memory or inline backends.

### 4.1 Install workspace dependencies

```bash
git clone <your-repo-url>
cd Indi-claude   # or your clone directory
npm install
```

### 4.2 Start the API

**Linux / macOS:**

```bash
cd services/api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export OTEL_SERVICE_NAME=codeforge-api
export OTEL_ENVIRONMENT=local
export CODEFORGE_API_BASE_URL=http://127.0.0.1:8000
export CODEFORGE_USER_ID=dev-user
export CODEFORGE_MODEL=deepseek-v4-flash

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Windows (PowerShell):**

```powershell
cd services/api
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:OTEL_SERVICE_NAME="codeforge-api"
$env:OTEL_ENVIRONMENT="local"
$env:CODEFORGE_API_BASE_URL="http://127.0.0.1:8000"
$env:CODEFORGE_USER_ID="dev-user"
$env:CODEFORGE_MODEL="deepseek-v4-flash"

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Verify:**

```bash
curl -s http://127.0.0.1:8000/health
# {"status":"ok"}
```

### 4.3 Start the web app (second terminal)

**Linux / macOS:**

```bash
export NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
npm run dev:web
```

**Windows (PowerShell):**

```powershell
$env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8000"
npm run dev:web
```

Open: http://localhost:3000

### 4.4 Optional clients (third+ terminals)

**Terminal:**

```bash
export CODEFORGE_API_BASE_URL=http://127.0.0.1:8000
export CODEFORGE_USER_ID=dev-user
export CODEFORGE_MODEL=deepseek-v4-flash
npm run dev:terminal
```

**Desktop:**

```bash
export VITE_CODEFORGE_API_BASE_URL=http://127.0.0.1:8000
npm run dev:desktop
```

**VS Code:** Open repo → F5 → run command `CodeForge: Open Panel`.

### 4.5 What works on native local (without extra services)

| Feature | Status on Path A | Notes |
|---------|------------------|-------|
| Dev login | Works | `POST /api/v1/auth/dev-login` |
| Sessions / chat / SSE | Works | Needs model provider keys for real LLM output |
| Usage summary | Works | |
| Billing APIs | Partial | Needs `RAZORPAY_KEY_*` for real checkout |
| Cowork scheduled jobs | **Degraded** | No Celery worker; in-process scheduler if enabled |
| Queue ping / worker jobs | **Degraded** | `task_queue` backend = `inline` |
| Vector / RAG | **Degraded** | `vector_store` backend = `memory` without Qdrant |
| Redis session store | **Degraded** | Falls back to memory |
| Git/shell file ops | Works | Scoped to API host filesystem |
| OIDC SSO | Partial | Set `CODEFORGE_OIDC_*` vars; dev-login disabled when OIDC on |

---

## 5. Path B — Docker Compose (recommended for full testing)

Mirrors CI smoke tests. Starts Postgres, Redis, Qdrant, API, worker, and web.

### 5.1 Configure environment

```bash
cp .env.example .env
```

Edit `.env` — minimum values for local compose:

```bash
POSTGRES_PASSWORD=change-me-local
SUPABASE_JWT_SECRET=local-dev-jwt-secret
RAZORPAY_KEY_ID=rzp_test_local
RAZORPAY_KEY_SECRET=local_razorpay_secret
CODEFORGE_ALLOW_DEV_LOGIN=true
CODEFORGE_CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

Optional for real LLM responses:

```bash
OPENAI_API_KEY=sk-...
CODEFORGE_SYNTHESIS_MODEL=gpt-4o-mini
```

### 5.2 Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Wait ~30–60s, then check containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

### 5.3 Automated smoke gates (same as CI)

Run these from repo root after the stack is up.

**1. API health**

```bash
curl -fsS http://127.0.0.1:8000/health
```

**2. Deploy readiness**

```bash
curl -fsS http://127.0.0.1:8000/api/v1/platform/deploy-readiness | python3 -m json.tool
```

Expect `"ready": true`. If false, inspect the `checks` array for failing items.

**3. Stack status** (redis, qdrant, celery must be healthy)

```bash
curl -fsS http://127.0.0.1:8000/api/v1/platform/stack-status | python3 -m json.tool
```

Expected healthy backends:

- `redis.backend` = `redis`
- `vector_store.backend` = `qdrant`
- `task_queue.backend` = `celery`

**4. Worker queue ping**

```bash
curl -fsS -X POST http://127.0.0.1:8000/api/v1/platform/queue-ping | python3 -m json.tool
# Note job_id from response, then poll:
curl -fsS http://127.0.0.1:8000/api/v1/platform/queue-ping/<job_id> | python3 -m json.tool
# Expect status success with result.status = ok
```

**5. Dev login + session flow**

```bash
TOKEN=$(curl -fsS -X POST http://127.0.0.1:8000/api/v1/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"smoke-user"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -fsS -X POST http://127.0.0.1:8000/api/v1/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"smoke session"}' | python3 -m json.tool

curl -fsS http://127.0.0.1:8000/api/v1/usage/summary \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**6. Web UI**

Open http://localhost:3000 — dev login, create a session, send a message.

### 5.4 Tear down

```bash
docker compose -f docker-compose.prod.yml down
# Add -v to wipe postgres volume
```

### 5.5 What works on Docker Compose

| Feature | Status | Notes |
|---------|--------|-------|
| Full API + web | Works | |
| Postgres persistence | Works | |
| Celery worker + beat | Works | Cowork ticks run on worker |
| Qdrant vector store | Works | Set `OPENAI_API_KEY` for real embeddings |
| Billing webhook HMAC | Works | With test Razorpay secrets |
| Deploy readiness gate | Works | With vars from section 5.1 |
| Playwright cowork jobs | Works | Worker image includes Chromium |
| OIDC | Partial | Set `CODEFORGE_OIDC_ENABLED=true` + IdP registration |
| Real Razorpay payments | Needs config | Test keys work for API flow; live keys for real money |
| EFS workspace mounts | N/A locally | Uses `./workspaces` host bind mount |

---

## 6. Path C — AWS EC2 Linux machine

Use a single Linux VM to run the same compose stack and test from your browser against the instance public IP or domain.

### 6.1 Launch and connect

1. Launch EC2 (Amazon Linux 2023 or Ubuntu 24.04), `t3.medium+`.
2. Attach security group: TCP `22`, `8000`, `3000` from your IP (tighten for production).
3. SSH in:

```bash
ssh -i your-key.pem ec2-user@<public-ip>    # Amazon Linux
# or
ssh -i your-key.pem ubuntu@<public-ip>      # Ubuntu
```

### 6.2 Install Docker

**Amazon Linux 2023:**

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in so docker group applies
```

**Ubuntu 24.04:**

```bash
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
# Log out and back in
```

Verify:

```bash
docker --version
docker compose version
```

### 6.3 Clone and configure

```bash
git clone <your-repo-url>
cd Indi-claude
cp .env.example .env
```

Edit `.env` for EC2 public access:

```bash
POSTGRES_PASSWORD=<strong-password>
SUPABASE_JWT_SECRET=<random-secret>
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
CODEFORGE_ALLOW_DEV_LOGIN=true
CODEFORGE_ENV=production
CODEFORGE_CORS_ORIGINS=http://<EC2_PUBLIC_IP>:3000
CODEFORGE_WEB_BASE_URL=http://<EC2_PUBLIC_IP>:3000
CODEFORGE_PUBLIC_API_BASE=http://<EC2_PUBLIC_IP>:8000
NEXT_PUBLIC_API_BASE=http://<EC2_PUBLIC_IP>:8000
```

Rebuild web image with the public API URL (compose build arg):

```bash
export EC2_IP=<EC2_PUBLIC_IP>
docker compose -f docker-compose.prod.yml build \
  --build-arg NEXT_PUBLIC_API_BASE=http://${EC2_IP}:8000 web
```

### 6.4 Start and verify

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

From your **local machine** (not EC2):

```bash
curl -fsS http://<EC2_PUBLIC_IP>:8000/health
curl -fsS http://<EC2_PUBLIC_IP>:8000/api/v1/platform/stack-status
```

Open http://\<EC2_PUBLIC_IP\>:3000 in your browser.

Run the smoke gates from **section 5.3**, replacing `127.0.0.1` with `<EC2_PUBLIC_IP>`.

### 6.5 Optional: Nginx + TLS on EC2

For HTTPS and a single origin:

```bash
sudo dnf install -y nginx certbot python3-certbot-nginx   # Amazon Linux
# or: sudo apt install -y nginx certbot python3-certbot-nginx  # Ubuntu
```

Example Nginx site (`/etc/nginx/conf.d/codeforge.conf`):

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
```

Update `.env` / rebuild web with `https://api.yourdomain.com` as `NEXT_PUBLIC_API_BASE`.

### 6.6 Point clients at EC2

On your laptop:

```bash
export CODEFORGE_API_BASE_URL=http://<EC2_PUBLIC_IP>:8000   # terminal
export VITE_CODEFORGE_API_BASE_URL=http://<EC2_PUBLIC_IP>:8000  # desktop
```

### 6.7 EC2 logs and debugging

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml ps
```

---

## 7. Path D — AWS ECS (staging / production)

For real cloud deploys, use committed assets — do not hand-roll services.

| Asset | Location |
|-------|----------|
| Dockerfiles | `services/api/Dockerfile`, `services/api/Dockerfile.worker`, `apps/web/Dockerfile` |
| ECS task definitions | `infra/ecs/staging/`, `infra/ecs/production/` |
| Terraform | `infra/terraform/README.md` |
| GitHub Actions deploy | `.github/workflows/deploy-ecs.yml` |
| SSM bootstrap | `scripts/bootstrap_{oidc,razorpay,qdrant}_ssm.py` |
| Post-deploy smoke | `scripts/post_deploy_public_smoke.sh` |

**Post-deploy verification:**

```bash
bash scripts/post_deploy_public_smoke.sh \
  https://api.yourdomain.com \
  https://app.yourdomain.com
```

**Known ECS gaps (fix before full cowork/delegation testing):**

- Worker taskdefs use `fs-PLACEHOLDER` — set GitHub vars `EFS_FILE_SYSTEM_ID_STAGING` / `EFS_FILE_SYSTEM_ID_PRODUCTION`
- OIDC: populate SSM `CODEFORGE_OIDC_*` (see `docs/deployment-assets-setup.md`)
- API tasks: `CODEFORGE_COWORK_SCHEDULER_ENABLED=false` (scheduler runs on worker via Celery beat)

---

## 8. Manual feature verification matrix

Use this checklist after any path. Mark each row: **Pass**, **Fail**, or **Skip**.

### 8.1 Platform health (no auth)

| # | Test | Command / action | Pass criteria |
|---|------|------------------|---------------|
| 1 | API health | `GET /health` | `{"status":"ok"}` |
| 2 | Deploy readiness | `GET /api/v1/platform/deploy-readiness` | `"ready": true` |
| 3 | Stack status | `GET /api/v1/platform/stack-status` | redis, vector, task_queue healthy |
| 4 | Worker consume | `POST /api/v1/platform/queue-ping` + poll | job completes with `ok` |

### 8.2 Auth & sessions

| # | Test | Action | Pass criteria |
|---|------|--------|---------------|
| 5 | Dev login | Web UI or `POST /api/v1/auth/dev-login` | Returns `access_token` |
| 6 | Create session | Web chat or `POST /api/v1/sessions` | Session ID returned |
| 7 | List sessions | Web sidebar or `GET /api/v1/sessions` | Includes new session |
| 8 | Send message + SSE | Web chat stream | Events stream; message persisted |
| 9 | OIDC SSO | Web SSO button | Only when OIDC configured; dev-login hidden |

### 8.3 Billing & orgs

| # | Test | Action | Pass criteria |
|---|------|--------|---------------|
| 10 | Billing context | `GET /api/v1/billing/context` | Plan info returned |
| 11 | Create order | Billing page or `POST /api/v1/billing/create-order` | `order_id` returned |
| 12 | Webhook | Razorpay test event or CI smoke | `status: processed` |

### 8.4 Code mode (API / terminal / desktop / VS Code)

| # | Test | Action | Pass criteria |
|---|------|--------|---------------|
| 13 | File read | Code workspace open folder | File tree loads |
| 14 | Git status | `/git status` or API | Branch + changes shown |
| 15 | Agent loop | `/loop` with small task | Proposal or diff streamed |
| 16 | Proposal apply | Approve diff in UI | File updated |

### 8.5 Cowork & worker

| # | Test | Action | Pass criteria |
|---|------|--------|---------------|
| 17 | Cowork plan | `/cowork` page create plan | Plan saved |
| 18 | Scheduled job | Enable cowork job | Worker logs show tick |
| 19 | Browser task | Cowork browser step | Playwright runs in worker container |

### 8.6 Team & projects

| # | Test | Action | Pass criteria |
|---|------|--------|---------------|
| 20 | Team workspace | `/team` create workspace | Workspace listed |
| 21 | Session grant | Grant member access | Member can open session |
| 22 | Vector probe | `deploy-readiness?probe_vector=true` | Qdrant reachable |

### 8.7 Clients

| # | Client | Action | Pass criteria |
|---|--------|--------|---------------|
| 23 | Web | Full chat + billing + team pages | No console API errors |
| 24 | Terminal | Login + session + routing banner | Connects to API |
| 25 | Desktop | Code + Cowork tabs | Tray launches; API reachable |
| 26 | VS Code | Open panel + workflow commands | Panel syncs with API |

---

## 9. Run API unit tests

```bash
cd services/api
python3.13 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest -q
```

Or from repo root: `npm run api:test`

---

## 10. Environment variable reference

Copy `.env.example` as the source of truth. Critical groups:

| Group | Variables | Required when |
|-------|-----------|---------------|
| Database | `DATABASE_URL`, `POSTGRES_PASSWORD` | Compose / production |
| Auth (dev) | `SUPABASE_JWT_SECRET`, `CODEFORGE_ALLOW_DEV_LOGIN` | Dev login in compose/CI |
| Auth (SSO) | `CODEFORGE_OIDC_*` | Production SSO |
| Billing | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Checkout + webhooks |
| Queue | `REDIS_URL`, `CELERY_BROKER_URL` | Worker-backed jobs |
| Vector | `QDRANT_URL`, `OPENAI_API_KEY` | RAG with real embeddings |
| Web | `NEXT_PUBLIC_API_BASE` | Built into web image at build time |
| Models | `OPENAI_API_KEY`, `CODEFORGE_MODEL`, synthesis vars | Real LLM responses |

Example env files for SSM bootstrap:

- `.env.oidc.example`
- `.env.razorpay.example`
- `.env.qdrant.example`

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `{"status":"ok"}` fails | API not started / wrong port | Check `uvicorn` or `docker compose ps` |
| Web loads, API calls fail | Wrong `NEXT_PUBLIC_API_BASE` | Rebuild web image with correct build arg |
| CORS errors in browser | Origin not allowed | Set `CODEFORGE_CORS_ORIGINS` to web URL |
| `deploy-readiness` not ready | Missing env vars | Read `checks[]` in JSON response |
| `stack-status` redis = memory | No Redis | Use compose stack or set `REDIS_URL` |
| `task_queue` = inline | No Celery | Start worker service in compose |
| `vector_store` = memory | No Qdrant | Start qdrant service; set `QDRANT_URL` |
| Worker queue ping times out | Worker container down | `docker compose logs worker` |
| Dev login 404 | OIDC enabled | Use SSO or set `CODEFORGE_ALLOW_DEV_LOGIN=true` (CI only) |
| EC2 connection refused | Security group | Open ports 8000/3000 to your IP |
| Billing webhook fails | Bad `RAZORPAY_KEY_SECRET` | Match secret used to sign payload |
| No real LLM output | No provider keys | Set `OPENAI_API_KEY` or configured model route |

**View API logs:**

```bash
# Native
# logs print to uvicorn terminal

# Compose
docker compose -f docker-compose.prod.yml logs -f api worker
```

---

## 12. Known gaps (repo status)

These items are documented as incomplete — expect **Fail** or **Skip** until configured:

| Area | Gap |
|------|-----|
| Production OIDC | IdP app registration + ECS SSM `CODEFORGE_OIDC_*` |
| Worker EFS | Replace `fs-PLACEHOLDER` in worker taskdefs |
| Terminal/VS Code OIDC | Paste-code flow; register `http://127.0.0.1:4583` and `:4584` callbacks |
| Long-horizon PRD | Voice, design-to-code, native mobile, localization |
| Synthesis production | Azure OpenAI required for prod rollout gate in CI |

---

## 13. Quick reference — URLs

| Surface | Local URL |
|---------|-----------|
| API | http://127.0.0.1:8000 |
| API health | http://127.0.0.1:8000/health |
| Deploy readiness | http://127.0.0.1:8000/api/v1/platform/deploy-readiness |
| Stack status | http://127.0.0.1:8000/api/v1/platform/stack-status |
| Web | http://localhost:3000 |
| Qdrant (compose) | http://localhost:6333 |

---

## 14. Phase 8 — RTK and memory (optional)

### RTK shell compression

RTK filters pytest/git/npm output before it reaches the agent context. The API and worker Docker images install the Linux `rtk` binary automatically.

**Enable globally (compose / API container):**

```env
CODEFORGE_RTK_ENABLED=true
CODEFORGE_RTK_DEBUG=false   # attach raw tail on non-zero exit
CODEFORGE_RTK_BINARY=       # optional explicit path
```

**Per-user toggle:** Web Settings → Token Saver, or terminal `/rtk on|off|status|gain`.

**Windows host (API outside Docker):** install RTK from [rtk-ai/rtk releases](https://github.com/rtk-ai/rtk/releases) and add to `PATH`. Shell-hook auto-rewrite requires WSL; CodeForge uses explicit `rtk` wrapping in `shell_ops.py`.

**Verify:**

```bash
curl.exe -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/v1/rtk/status
```

### Native agent memory

Cross-session memory is stored in Postgres (`agent_memories`) and Qdrant. No extra SaaS required.

- Terminal: `/memory search|save|list|export`
- Web: Settings → **Memory**
- Auto-capture on `/compact` and approved architectural proposals

### Supermemory BYOK (optional)

Requires [Supermemory Pro](https://supermemory.ai/docs/integrations/claude-code) and an API key.

```env
SUPERMEMORY_CC_API_KEY=sm_...
SUPERMEMORY_API_URL=https://api.supermemory.ai
```

Per-repo overrides: copy [`.codeforge/supermemory.json.example`](.codeforge/supermemory.json.example) to `<project>/.codeforge/supermemory.json`.

```bash
curl.exe -H "Authorization: Bearer <token>" "http://127.0.0.1:8000/api/v1/supermemory/status"
```

---

## 15. Phase 9 — ScrapeGraphAI (optional)

Cowork can run natural-language extraction from URLs or local docs via [ScrapeGraphAI](https://github.com/ScrapeGraphAI/Scrapegraph-ai). Results ingest into project knowledge and agent memory.

**Requirements:** `OPENAI_API_KEY` (or compatible LiteLLM provider), `scrapegraphai` in API image (`requirements.txt`).

```env
CODEFORGE_SCRAPE_ENABLED=true
CODEFORGE_SCRAPE_MODEL=openai/gpt-4o-mini   # optional
```

**Quick test:**

```bash
curl.exe -X POST http://127.0.0.1:8000/api/v1/cowork/scrape ^
  -H "Authorization: Bearer <token>" ^
  -H "Content-Type: application/json" ^
  -d "{\"session_id\":\"<sid>\",\"scrape_prompt\":\"Extract API endpoints\",\"url\":\"https://example.com\",\"approved\":true}"
```

Terminal: `/cowork scrape https://example.com --prompt "Extract headings" --approve`

See [docs/tickets/phase-9-scrape.md](docs/tickets/phase-9-scrape.md).

---

## 16. Phase 10 — Anthropic skills pack

Bundled instruction skills adapted from [anthropics/skills](https://github.com/anthropics/skills) (Apache-2.0):

| Skill | Use when |
|-------|----------|
| `frontend-design` | Distinctive UI, landing pages, anti-template aesthetics |
| `webapp-testing` | Playwright / Cowork browser verification |
| `mcp-builder` | Building MCP servers (Python or TypeScript) |
| `skill-creator` | Authoring `.codeforge/skills/*/SKILL.md` |
| `doc-coauthoring` | Proposals, specs, RFCs, decision docs |

Also bundled: `caveman` (MIT token saver), `pr-conventions` (CodeForge-native).

**Enable skills:**

- Web: Settings → **Token Saver** → skill groups (Project / Anthropic / CodeForge)
- Terminal: `/caveman skills`
- API:

```bash
curl.exe -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/v1/skills

curl.exe -X PUT http://127.0.0.1:8000/api/v1/agent/preferences ^
  -H "Authorization: Bearer <token>" ^
  -H "Content-Type: application/json" ^
  -d "{\"enabled_skills\":[\"frontend-design\",\"mcp-builder\"]}"
```

**Project overrides:** copy or author `<repo>/.codeforge/skills/<name>/SKILL.md` — project skills win over bundled names.

Attribution: [.codeforge/skills/THIRD_PARTY_NOTICES.md](.codeforge/skills/THIRD_PARTY_NOTICES.md). Details: [docs/tickets/phase-10-anthropic-skills.md](docs/tickets/phase-10-anthropic-skills.md).

---

## 17. Local pytest (API)

Use Python **3.13** in a venv under `services/api` (avoid system 3.14 until deps catch up).

### Test harness defaults

`services/api/tests/conftest.py` applies an autouse `fast_local_test_env` fixture to every test:

- Forces per-test SQLite (`tmp_path/codeforge.db`) even when the shell has `DATABASE_URL` or `.env.local`
- Clears `OPENAI_API_KEY`, `QDRANT_URL`, and `CODEFORGE_EMBEDDING_MODEL` so tests stay offline
- Resets the in-process `vector_store` singleton to deterministic in-memory mode

No extra env setup is required for the phase 7–10 test modules.

### Windows (PowerShell)

```powershell
cd services\api
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
$env:CODEFORGE_ENV = "development"
.\.venv\Scripts\python -m pytest tests/test_scrape.py tests/test_rtk.py tests/test_memory.py tests/test_skills.py tests/test_taste.py -v
```

### Linux / macOS

```bash
cd services/api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export CODEFORGE_ENV=development
python -m pytest tests/test_scrape.py tests/test_rtk.py tests/test_memory.py tests/test_skills.py tests/test_taste.py -v
```

### SSE endpoints in tests

Long-lived SSE streams should use probe mode where supported:

```bash
curl -H "Authorization: Bearer <token>" "http://127.0.0.1:8000/api/v1/team/events?probe=true"
```

`probe=true` returns a single `connected` event and closes — used by `test_team_events_stream_connected` in `test_backlog_completion.py`.

Full `pytest tests/` may still hang on other long-running SSE cases; add `--timeout=60` if `pytest-timeout` is installed.

---

## 18. Related docs

- [README.md](README.md) — repo overview and current status
- [docs/tickets/phase-7-taste.md](docs/tickets/phase-7-taste.md) — taste rules + caveman/skills
- [docs/tickets/phase-8-memory.md](docs/tickets/phase-8-memory.md) — RTK + memory implementation notes
- [docs/tickets/phase-9-scrape.md](docs/tickets/phase-9-scrape.md) — ScrapeGraphAI Cowork extraction
- [docs/tickets/phase-10-anthropic-skills.md](docs/tickets/phase-10-anthropic-skills.md) — curated Anthropic skills pack
- [docs/deployment-assets-setup.md](docs/deployment-assets-setup.md) — SSM / ECS operator setup
- [docs/production-domains.md](docs/production-domains.md) — TLS and DNS
- [docs/qdrant-ecs-setup.md](docs/qdrant-ecs-setup.md) — Qdrant on ECS
- [infra/terraform/README.md](infra/terraform/README.md) — Terraform two-phase apply
- [INDEX.md](INDEX.md) — spec index and recent shipped batches
