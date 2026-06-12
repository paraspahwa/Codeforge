Here is a complete EC2 Linux runbook for this repo. It follows DEPLOYMENT_RUNBOOK.md section 6 and docker-compose.prod.yml.

Replace placeholders:

<YOUR_KEY.pem> — your SSH key file
<EC2_PUBLIC_IP> — instance public IPv4
paraspahwa/Indi-claude — your GitHub repo if different
What you are deploying on one EC2 box
Container	Port	Purpose
codeforge-db
internal
Postgres (sessions, billing, prefs)
codeforge-redis
internal
Cache + Celery queue
codeforge-qdrant
6333
Vector memory
codeforge-api
8000
FastAPI backend (chat, SSE, billing, team, cowork APIs)
codeforge-worker
—
Celery + Playwright (background cowork jobs)
codeforge-web
3000
Next.js UI
Not on EC2: desktop (Tauri), terminal, VS Code — those run on your laptop and point at the EC2 API.

Phase 0 — Launch EC2 in AWS Console
EC2 → Launch instance
AMI: Ubuntu 24.04 LTS (easiest) or Amazon Linux 2023
Instance type: t3.medium (4 GB RAM) — worker + Playwright needs this; t3.small often OOMs
Storage: 30 GB gp3 (Docker images are large)
Key pair: create/download .pem
Security group — inbound rules:
Port	Source	Why
22
Your IP
SSH
8000
Your IP
API (testing)
3000
Your IP
Web UI
Use My IP in the console, not 0.0.0.0/0, unless you accept the security risk.

Launch → copy Public IPv4 → that is <EC2_PUBLIC_IP>
Phase 1 — SSH into the machine
From your Windows laptop (PowerShell):

# Fix key permissions (Windows OpenSSH)
icacls <YOUR_KEY.pem> /inheritance:r
icacls <YOUR_KEY.pem> /grant:r "$($env:USERNAME):(R)"
# Connect — Ubuntu AMI uses user "ubuntu"
ssh -i <YOUR_KEY.pem> ubuntu@<EC2_PUBLIC_IP>
# Amazon Linux 2023 uses user "ec2-user"
ssh -i <YOUR_KEY.pem> ec2-user@<EC2_PUBLIC_IP>
What this does: Opens a shell on the EC2 instance so you run all following commands there (unless noted “from laptop”).

Phase 2 — Install Docker + Git on EC2
Option A — Ubuntu 24.04 (recommended)
Run on EC2:

# Refresh package index
sudo apt-get update -y
# Install Docker engine, Compose v2 plugin, and Git
sudo apt-get install -y docker.io docker-compose-v2 git curl
# Start Docker on boot and now
sudo systemctl enable --now docker
# Allow your user to run docker without sudo
sudo usermod -aG docker $USER
# Apply group membership without full logout (or disconnect SSH and reconnect)
newgrp docker
# Verify installs
docker --version
docker compose version
git --version
Command	Purpose
apt-get update
Refresh Ubuntu package lists
docker.io
Docker daemon
docker-compose-v2
docker compose (v2) for multi-container stack
git
Clone the repo
usermod -aG docker
Run Docker without sudo
newgrp docker
Activate docker group in current shell
Option B — Amazon Linux 2023
sudo dnf update -y
sudo dnf install -y docker git curl
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
# Compose plugin (if package missing, install plugin manually)
sudo dnf install -y docker-compose-plugin 2>/dev/null || true
docker compose version || echo "Install compose plugin if this fails"
Phase 3 — Clone repo on EC2
# Go to home directory
cd ~
# Clone your project (HTTPS — no GitHub SSH key needed on EC2)
git clone https://github.com/paraspahwa/Indi-claude.git
# Enter repo root — all docker commands run from here
cd Indi-claude
# Confirm compose file exists
ls -la docker-compose.prod.yml
Command	Purpose
git clone
Downloads full monorepo (API, web, worker Dockerfiles)
cd Indi-claude
Repo root where .env and compose file live
Phase 4 — Create .env (fixes your POSTGRES_PASSWORD error)
# Copy starter env file
cp .env.example .env
# Auto-detect this instance's public IP (works on EC2)
export EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "EC2 public IP: $EC2_IP"
Edit .env with nano:

nano .env
Minimum values for EC2 testing (paste and replace secrets):

# --- Required by docker-compose.prod.yml (compose will FAIL without these) ---
POSTGRES_PASSWORD=MyStrongDbPass123!
SUPABASE_JWT_SECRET=any-long-random-string-for-testing
# --- Auth: allow "Continue" dev login in browser ---
CODEFORGE_ALLOW_DEV_LOGIN=true
CODEFORGE_ENV=production
# --- Billing (test keys — API won't crash; real payments need Razorpay dashboard) ---
RAZORPAY_KEY_ID=rzp_test_local
RAZORPAY_KEY_SECRET=local_razorpay_secret
# --- URLs must use EC2 public IP, not localhost ---
CODEFORGE_CORS_ORIGINS=http://<EC2_PUBLIC_IP>:3000
CODEFORGE_WEB_BASE_URL=http://<EC2_PUBLIC_IP>:3000
CODEFORGE_PUBLIC_API_BASE=http://<EC2_PUBLIC_IP>:8000
NEXT_PUBLIC_API_BASE=http://<EC2_PUBLIC_IP>:8000
# --- LLM (optional for smoke; REQUIRED for real AI replies) ---
OPENAI_API_KEY=sk-your-openai-key-here
CODEFORGE_SYNTHESIS_MODEL=gpt-4o-mini
# --- Workspaces on disk (git/shell/cowork file ops) ---
CODEFORGE_HOST_WORKSPACES=./workspaces
Save in nano: Ctrl+O, Enter, Ctrl+X.

Variable	Why
POSTGRES_PASSWORD
Required — compose errors without it (POSTGRES_PASSWORD must be set)
SUPABASE_JWT_SECRET
Required — JWT signing for API auth
CODEFORGE_ALLOW_DEV_LOGIN=true
Browser “dev login” without OIDC
CODEFORGE_CORS_ORIGINS
Browser on :3000 may call API on :8000 — must match
NEXT_PUBLIC_API_BASE
Baked into web at build time — must be EC2 IP, not localhost
OPENAI_API_KEY
Without it, chat uses deterministic fallback text (smoke OK, not real AI)
Phase 5 — Pass LLM keys into containers (important)
docker-compose.prod.yml does not forward OPENAI_API_KEY into the API/worker containers by default. Create an override:

cat > docker-compose.override.yml << 'EOF'
services:
  api:
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL:-https://api.openai.com/v1}
      CODEFORGE_SYNTHESIS_MODEL: ${CODEFORGE_SYNTHESIS_MODEL:-gpt-4o-mini}
      CODEFORGE_EMBEDDING_MODEL: ${CODEFORGE_EMBEDDING_MODEL:-text-embedding-3-small}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      CODEFORGE_SCRAPE_ENABLED: ${CODEFORGE_SCRAPE_ENABLED:-true}
  worker:
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL:-https://api.openai.com/v1}
      CODEFORGE_SYNTHESIS_MODEL: ${CODEFORGE_SYNTHESIS_MODEL:-gpt-4o-mini}
      CODEFORGE_SCRAPE_ENABLED: ${CODEFORGE_SCRAPE_ENABLED:-true}
EOF
Docker Compose auto-merges docker-compose.override.yml with docker-compose.prod.yml.

Phase 6 — Build images (web must know API URL)
cd ~/Indi-claude
# Set EC2 IP for build arg (use metadata if still in same shell)
export EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
# Create workspaces folder for git/shell sandboxes
mkdir -p workspaces
# Build ONLY web first with correct API URL baked in
# (Next.js embeds NEXT_PUBLIC_API_BASE at build time)
docker compose -f docker-compose.prod.yml build \
  --build-arg NEXT_PUBLIC_API_BASE=http://${EC2_IP}:8000 \
  web
Command	Purpose
mkdir -p workspaces
Host folder mounted into API/worker as /workspaces
build --build-arg NEXT_PUBLIC_API_BASE=...
Web app calls EC2 API, not localhost:8000 inside your browser
First full build takes ~10–25 minutes (Python API + Playwright worker + Node web).

Phase 7 — Start entire stack
# Build remaining services and start all containers in background
docker compose -f docker-compose.prod.yml up -d --build
Flag	Purpose
-d
Detached (runs in background)
--build
Build api, worker, db, redis, qdrant if not built
Wait ~60–90 seconds, then check:

# Show container status — all should be "Up" (db/redis "healthy")
docker compose -f docker-compose.prod.yml ps
# Tail API logs (Ctrl+C to stop tailing)
docker compose -f docker-compose.prod.yml logs -f api
Phase 8 — Smoke tests (from your laptop or EC2)
Replace 127.0.0.1 with <EC2_PUBLIC_IP> if running from your laptop.

8.1 API health
curl -fsS http://<EC2_PUBLIC_IP>:8000/health
Expected: {"status":"ok"} — API process is up.

8.2 Deploy readiness
curl -fsS http://<EC2_PUBLIC_IP>:8000/api/v1/platform/deploy-readiness | python3 -m json.tool
Expected: "ready": true with passing checks (DB, Redis, Qdrant, auth, billing placeholders).

8.3 Stack status (infra wiring)
curl -fsS http://<EC2_PUBLIC_IP>:8000/api/v1/platform/stack-status | python3 -m json.tool
Expected:

redis backend healthy
qdrant backend healthy
celery task queue healthy
8.4 Worker queue ping
# Enqueue a test job on Celery worker
curl -fsS -X POST http://<EC2_PUBLIC_IP>:8000/api/v1/platform/queue-ping | python3 -m json.tool
Copy job_id from output, then:

curl -fsS http://<EC2_PUBLIC_IP>:8000/api/v1/platform/queue-ping/<job_id> | python3 -m json.tool
Expected: status: success — worker container + Redis broker work.

8.5 Auth + session API
# Get dev-login token
TOKEN=$(curl -fsS -X POST http://<EC2_PUBLIC_IP>:8000/api/v1/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"ec2-smoke-user"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "Token: $TOKEN"
# Create session (requires project_path, not title)
curl -fsS -X POST http://<EC2_PUBLIC_IP>:8000/api/v1/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_path":"/workspaces/demo","model_preference":"auto"}' | python3 -m json.tool
# Usage summary
curl -fsS http://<EC2_PUBLIC_IP>:8000/api/v1/usage/summary \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
Step	What it tests
dev-login
Auth bypass for staging
POST /sessions
Postgres persistence
usage/summary
Billing/limits layer
Phase 9 — Browser UI testing (what to click)
Open in your browser:

http://<EC2_PUBLIC_IP>:3000
Area	Path / action	What should work
Login
Dev login / Continue
Works if CODEFORGE_ALLOW_DEV_LOGIN=true
Chat
Create session, send message
Works; real AI needs OPENAI_API_KEY in override
Code
/code
Git/shell/file preview (needs project under workspaces/)
Settings
Token saver, memory, taste, skills
API prefs round-trip
Team
/team
Team APIs (basic flows)
Cowork
/cowork
Needs worker + optional Playwright
Billing
Billing page
Test Razorpay keys — UI flow, not live money
Analytics
Routing benchmarks
API-backed charts
If web loads but API calls fail: NEXT_PUBLIC_API_BASE was wrong at build time → rebuild web (Phase 6) with correct EC2_IP.

If CORS errors in browser console: CODEFORGE_CORS_ORIGINS must be exactly http://<EC2_PUBLIC_IP>:3000.

Phase 10 — Feature matrix (what works without extra setup)
Feature	Works on EC2 compose?	Needs
Web + API + DB + Redis + Qdrant
Yes
Phases 4–7
Dev login
Yes
CODEFORGE_ALLOW_DEV_LOGIN=true
Chat (fallback text)
Yes
No OpenAI key
Chat (real LLM)
Yes
OPENAI_API_KEY + override file
SSE streaming
Yes
Session + message + stream
Proposals / diffs
Yes
Code intent + synthesis
Memory / taste / skills
Yes
OpenAI for embeddings (memory search)
Celery cowork jobs
Yes
Worker container healthy
Playwright browser cowork
Yes
t3.medium+, worker logs clean
Razorpay billing
Partial
Test keys; webhook needs public HTTPS URL
OIDC SSO
Partial
IdP + CODEFORGE_OIDC_* vars
Hermes engine
Optional
CODEFORGE_HERMES_ENABLED=true + Hermes binary on API host
Desktop / Terminal
From laptop
Point env at EC2 API (below)
Phase 11 — Point local clients at EC2 (optional)
On your Windows laptop (not on EC2):

# Terminal client
$env:CODEFORGE_API_BASE_URL = "http://<EC2_PUBLIC_IP>:8000"
cd C:\Users\paras\Indi-claude
npm run dev:terminal
# Desktop client
$env:VITE_CODEFORGE_API_BASE_URL = "http://<EC2_PUBLIC_IP>:8000"
npm run dev:desktop
Phase 12 — Logs and debugging on EC2
cd ~/Indi-claude
# All services status
docker compose -f docker-compose.prod.yml ps
# Follow logs per service
docker compose -f docker-compose.prod.yml logs -f api      # API errors, auth, SSE
docker compose -f docker-compose.prod.yml logs -f worker   # Celery, Playwright, cowork
docker compose -f docker-compose.prod.yml logs -f web      # Next.js
docker compose -f docker-compose.prod.yml logs -f db       # Postgres
# Restart one service after .env change
docker compose -f docker-compose.prod.yml up -d --build api worker
# Full restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
Symptom	Likely cause	Fix
POSTGRES_PASSWORD must be set
No .env or empty var
Phase 4
Connection refused from laptop
Security group
Open 3000/8000 to your IP
Web OK, API calls fail
Wrong NEXT_PUBLIC_API_BASE
Rebuild web (Phase 6)
CORS error
Wrong CODEFORGE_CORS_ORIGINS
Match http://IP:3000
ready: false
Missing secret
Read deploy-readiness checks array
Worker OOM / restart loop
Instance too small
Use t3.medium
Generic chat replies
No OpenAI key in container
Phase 5 override
Queue ping fails
Worker down
logs worker, check Redis
Phase 13 — Stop / clean up
# Stop containers (keep data)
docker compose -f docker-compose.prod.yml down
# Stop and wipe Postgres volume (full reset)
docker compose -f docker-compose.prod.yml down -v
In AWS Console: Stop or Terminate instance when done to avoid charges.

Quick copy-paste sequence (EC2, after SSH)
sudo apt-get update -y && sudo apt-get install -y docker.io docker-compose-v2 git curl
sudo systemctl enable --now docker && sudo usermod -aG docker $USER && newgrp docker
cd ~ && git clone https://github.com/paraspahwa/Indi-claude.git && cd Indi-claude
cp .env.example .env
export EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
nano .env   # fill POSTGRES_PASSWORD, SUPABASE_JWT_SECRET, URLs with $EC2_IP
# add docker-compose.override.yml from Phase 5
mkdir -p workspaces
docker compose -f docker-compose.prod.yml build --build-arg NEXT_PUBLIC_API_BASE=http://${EC2_IP}:8000 web
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -fsS http://${EC2_IP}:8000/health
Then open http://<EC2_PUBLIC_IP>:3000 and run Phase 8 smoke tests.

Your earlier error (POSTGRES_PASSWORD must be set) happens when .env is missing or empty before docker compose up. Creating .env in Phase 4 before starting fixes it.

If you want, I can add a scripts/ec2-bootstrap.sh to the repo that automates Phases 2–7 on Ubuntu.