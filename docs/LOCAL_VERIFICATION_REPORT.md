# CodeForge Local Verification Report

**Date:** 2026-06-10  
**Machine:** Windows 10, repo `C:\Users\paras\Indi-claude`  
**Plan:** Native smoke (Supabase) + Docker Compose hybrid + pytest + web route checks

---

## 1. Environment snapshot

| Tool | Version | Status |
|------|---------|--------|
| Node.js | v24.13.1 | OK |
| npm | 11.8.0 | OK |
| Python | 3.13.14 | OK |
| Docker CLI | 29.5.3 | Installed |
| Docker Compose | v5.1.4 | Installed |
| **Docker Desktop daemon** | — | **Not running** (`dockerDesktopLinuxEngine` pipe missing) |

Dependencies installed during this run:

- Root `npm install` (316 packages)
- `services/api/.venv` + `requirements.txt`

---

## 2. Repo status (code vs ops)

### Shipped (Phases 0–11)

Core product code is in place per [README.md](../README.md) and [docs/tickets/README.md](tickets/README.md):

- FastAPI backend: auth, sessions, SSE, billing, cowork, team, routing, memory, skills, scrape, Hermes adapter
- Web: `/app` (chat), `/` (landing), `/pricing`, `/privacy`, `/terms`, `/code`, `/settings`, `/cowork`, `/team`, billing, analytics, PWA
- Desktop, terminal, VS Code clients
- CI: pytest + `docker-compose.prod.yml` smoke in `.github/workflows/deploy-ecs.yml`

### Still missing (operator / config)

| Gap | Type |
|-----|------|
| Supabase `DATABASE_URL` in `.env.local` — hostname does not resolve | **Local blocker** |
| Docker Desktop not running | **Local blocker** for Redis/Qdrant/worker |
| OIDC IdP + ECS SSM `CODEFORGE_OIDC_*` | Production ops |
| Worker EFS `fs-PLACEHOLDER` in ECS taskdefs | Production ops |
| Azure OpenAI for prod synthesis CI gate | Production ops |
| Razorpay webhooks on localhost | Expected skip |
| PRD long-horizon: voice, mobile, design-to-code, i18n | Not started |

---

## 3. Bugs found and fixed during verification

### 3.1 `vector_store.py` — missing `logger` (fixed)

When Qdrant is unreachable, fallback code called `logger.warning(...)` but `logger` was never defined → **API import crash**.

**Fix:** Added `import logging` and `logger = logging.getLogger(__name__)`.

### 3.2 `cache.py` — missing `logger` + Redis hang (fixed)

Same missing `logger` on Redis fallback paths. Redis client was created without verifying connectivity; `set()` during startup could block for a long time when Redis was down.

**Fix:** Added logger; `ping()` on init with `socket_connect_timeout=1` / `socket_timeout=1`; fall back to in-memory on failure.

---

## 4. Phase 1 — Native API + web

### 4.1 Supabase (planned path) — **FAIL**

```
nslookup db.grbjzspvheehebhskkap.supabase.co
→ Non-existent domain
```

API startup with `.env.local` `DATABASE_URL`:

```
psycopg.OperationalError: failed to resolve host 'db.grbjzspvheehebhskkap.supabase.co'
```

**Action:** Confirm Supabase project still exists; update `DATABASE_URL` in `.env.local` (include `?sslmode=require` if using Supabase pooler).

### 4.2 Live `uvicorn` on port 8000/8001 — **FAIL (hang)**

Multiple attempts to run:

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Observed: `Waiting for application startup` for 90s+ without completing. Likely compounded by:

- Many stuck background Python/uvicorn processes from repeated attempts
- Slow `app.main` import (~27s) when `.env.local` loaded (OpenAI/litellm paths)
- Startup embedding call ~25s when `OPENAI_API_KEY` set

**Workaround used:** FastAPI `TestClient` via pytest (same stack as CI unit tests).

### 4.3 API smoke via pytest — **PASS**

| Check | Result |
|-------|--------|
| `tests/test_api_integration.py` (4 tests) | **PASS** |
| `tests/test_deploy_readiness.py` (8 tests) | **PASS** |
| Combined integration + deploy-readiness (12 tests) | **PASS** in 9.06s |

Covers: `/health`, dev-login, sessions, usage, deploy-readiness checks.

### 4.4 Full pytest suite — **PARTIAL**

```
126 passed, 46 failed in 145.53s
```

Failure clusters:

| Pattern | Count (approx) | Cause |
|---------|----------------|-------|
| `KeyError: 'access_token'` | Many | Dev-login returns non-200 under bulk run (rate limit / ordering) |
| `assert 429 == 404` | Several | Rate limiter (`CODEFORGE_RATE_LIMIT`) hits dev-login in production-mode tests |
| Other | Few | Agent loop, patch generator, shell ops |

**Note:** Core integration path passes in isolation; full suite needs test isolation fixes or higher rate limits in test env.

### 4.5 Web app (Next.js dev) — **PASS (pages load)**

```powershell
$env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8000"
npm run dev:web
```

Ready in ~22s. HTTP status codes (first compile):

| Route | Status |
|-------|--------|
| `/` | 200 |
| `/login` | 200 |
| `/code` | 200 |
| `/settings` | 200 |
| `/cowork` | 200 |
| `/team` | 200 |
| `/billing` | 200 |

**Not verified interactively:** Login, chat SSE, API-backed actions (no stable live API on 8000 during this run).

---

## 5. Phase 2 — Docker Compose (Redis + Qdrant + worker)

**Status: BLOCKED**

```
docker compose -f docker-compose.prod.yml up -d redis qdrant
→ failed to connect to the docker API ... dockerDesktopLinuxEngine
```

**Action:** Start Docker Desktop, then:

```powershell
cd C:\Users\paras\Indi-claude
Copy-Item .env.example .env   # if not present
docker compose -f docker-compose.prod.yml up -d redis qdrant worker
```

Re-run stack gates from [DEPLOYMENT_RUNBOOK.md](../DEPLOYMENT_RUNBOOK.md) §5.3.

---

## 6. Feature verification matrix

| # | Feature | Phase 1 result | Notes |
|---|---------|----------------|-------|
| 1 | API `/health` | **Pass** | Via pytest TestClient |
| 2 | Deploy readiness | **Pass** | Dev env, SQLite |
| 3 | Stack status | **Degraded** | redis/qdrant memory/inline without Docker |
| 4 | Worker queue ping | **Degraded** | `inline` backend without Celery |
| 5 | Dev login | **Pass** | Integration test |
| 6 | Create/list sessions | **Pass** | Integration test |
| 7 | Send message + SSE | **Skip** | No live API + browser |
| 8 | OIDC SSO | **Skip** | `CODEFORGE_OIDC_ENABLED=false` |
| 9 | Billing context | **Pass** | In integration tests |
| 10 | Billing webhook | **Skip** | No public URL |
| 11–22 | Code/cowork/team/vector | **Partial** | Many pytest failures under bulk run |
| 23 | Web routes render | **Pass** | All 200 |
| 24–26 | Terminal/desktop/VS Code | **Skip** | Out of scope this run |

---

## 7. Recommended next steps (priority)

### P0 — Unblock local dev

1. **Fix Supabase URL** in `.env.local` or use SQLite for local API:
   ```powershell
   # From services/api — load env without broken DATABASE_URL
   .venv\Scripts\python.exe -c "from pathlib import Path; import os; from dotenv import load_dotenv; load_dotenv(Path(r'C:\Users\paras\Indi-claude\.env.local')); os.environ.pop('DATABASE_URL',None); ..."
   ```
2. **Start Docker Desktop** before compose/worker tests.
3. **Load `.env.local` on Windows** — use repo-root path, not `..\.env.local` from `services/api`:
   ```powershell
   Get-Content C:\Users\paras\Indi-claude\.env.local | Where-Object { $_ -match '^\s*[^#]' -and $_ -match '=' } | ForEach-Object {
     $n,$v = $_ -split '=',2; Set-Item -Path "env:$($n.Trim())" -Value $v.Trim()
   }
   ```
   Or use `python-dotenv` in a small `scripts/start_api_local.py` helper.

### P1 — Test hygiene

- Fix 46 failing tests: rate-limit bypass in pytest (`CODEFORGE_RATE_LIMIT_PER_MINUTE=9999`) or per-test redis memory backend reset.
- Add `scripts/run_local_smoke.py` to CI optional job (TestClient-based).

### P2 — Production ops

- OIDC SSM bootstrap + IdP redirect URIs
- EFS IDs for worker ECS taskdefs
- Rotate Razorpay keys if `.env.local` was ever exposed in chat/logs

---

## 8. Files added/changed in this verification

| File | Change |
|------|--------|
| `services/api/app/vector_store.py` | Added missing `logger` |
| `services/api/app/cache.py` | Added `logger` + Redis ping/timeout |
| `scripts/run_local_smoke.py` | TestClient smoke script (optional) |
| `.env` | Copied from `.env.example` for future compose |
| `docs/LOCAL_VERIFICATION_REPORT.md` | This report |

---

## 9. Quick re-run commands

```powershell
# Core API tests (offline, fast)
cd services\api
.venv\Scripts\Activate.ps1
pytest tests/test_api_integration.py tests/test_deploy_readiness.py -q

# Web dev
cd C:\Users\paras\Indi-claude
$env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8000"
npm run dev:web

# Full stack (after Docker Desktop + valid .env)
docker compose -f docker-compose.prod.yml up -d --build
curl.exe http://127.0.0.1:8000/health
```

---

## 10. Production go-live implementation (2026-06-10)

Implemented per production go-live plan:

### Web — public site & routing

| Route | Purpose |
|-------|---------|
| `/` | Public marketing landing |
| `/pricing`, `/privacy`, `/terms`, `/about` | Public pages |
| `/app` | Authenticated chat (moved from `/`) |
| `/login`, `/auth/callback` | Auth flows |

### Web — auth hardening

- `@supabase/supabase-js` client (`apps/web/lib/supabase-client.js`)
- Login: SSO (OIDC) + Supabase email/password, magic link, Google OAuth
- `middleware.js` redirects unauthenticated users on protected routes
- httpOnly session cookie via `/api/auth/session` and `/api/auth/logout`

### API

- `deploy_readiness.py`: `auth_provider_configured` + dual OIDC+Supabase checks
- `oidc_state.py`: Redis-backed OIDC CSRF state when `REDIS_URL` is available

### Verification run

| Check | Result |
|-------|--------|
| `npm run build:web` | **PASS** (26 routes, middleware 26.7 kB) |
| `pytest tests/test_deploy_readiness.py` | **PASS** (8/8) |

### Operator next steps

1. Copy `.env.production.template` → `.env` on VPS; fill domains, Supabase, OIDC, Razorpay, Qdrant, Redis.
2. Set `apps/web` build env: `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Register Razorpay webhook: `https://api.yourdomain.com/api/v1/billing/webhook`.
4. Register IdP redirect: `https://app.yourdomain.com/auth/callback`.
5. `curl https://api.yourdomain.com/api/v1/platform/deploy-readiness` → `"ready": true`.
