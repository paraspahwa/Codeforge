# CodeForge End-to-End Runbook (Local + AWS + Production)

This guide is a single, step-by-step playbook to run CodeForge locally and deploy it to AWS for production.

## 1) What You Are Deploying

CodeForge repo surfaces:

- API backend: FastAPI (Python) in services/api
- Web app: Next.js in apps/web
- Desktop app: Tauri in apps/desktop (client, not hosted on AWS)
- Terminal app: Ink CLI in apps/terminal (client, not hosted on AWS)
- VS Code extension: apps/vscode (client distribution, not hosted on AWS)

In cloud production, the hosted core is usually:

- API service (required)
- Web service (recommended)
- Managed database (recommended: PostgreSQL/RDS)

Desktop, terminal, and VS Code clients should point to your production API base URL.

## 2) Prerequisites

## 2.1 Local machine requirements

Install:

1. Git
2. Node.js 20 LTS (or newer LTS) and npm
3. Python 3.13 (important: this repo is validated on Python 3.13)
4. Rust toolchain (rustup + cargo) for Tauri desktop
5. VS Code (for extension development/testing)

Notes:

- Backend currently defaults to SQLite if DATABASE_URL is not set.
- For production, use PostgreSQL (RDS on AWS).

## 2.2 AWS requirements

Prepare:

1. AWS account with billing enabled
2. IAM user/role with permissions for VPC, ECS, ECR, ALB, RDS, Route53, ACM, CloudWatch, SSM, Secrets Manager
3. AWS CLI configured (`aws configure`)
4. A domain name (recommended) for HTTPS

## 3) Local Setup (Full Project)

Run these from repo root unless specified.

## 3.1 Install workspace dependencies

1. Open terminal at repo root.
2. Install Node workspace packages:

```bash
npm install
```

## 3.2 Start backend API (required first)

1. Go to API folder:

```bash
cd services/api
```

2. Create virtual environment (Python 3.13):

```bash
py -3.13 -m venv .venv
```

3. Activate venv (PowerShell):

```powershell
.venv\Scripts\Activate.ps1
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

5. (Optional but recommended) set local env values in the same terminal session:

```powershell
$env:OTEL_SERVICE_NAME="codeforge-api"
$env:OTEL_ENVIRONMENT="local"
$env:CODEFORGE_API_BASE_URL="http://127.0.0.1:8000"
$env:CODEFORGE_USER_ID="paras"
$env:CODEFORGE_MODEL="deepseek-v4-flash"
```

6. Run API:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

7. Verify API health:

```bash
curl http://127.0.0.1:8000/health
```

Expected result:

```json
{"status":"ok"}
```

## 3.3 Start web app

1. Open second terminal at repo root.
2. Set API base for Next.js in current terminal:

```powershell
$env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8000"
```

3. Run web dev server:

```bash
npm run dev:web
```

4. Open:

- http://localhost:3000

## 3.4 Run terminal app

1. Open third terminal at repo root.
2. Set environment:

```powershell
$env:CODEFORGE_API_BASE_URL="http://127.0.0.1:8000"
$env:CODEFORGE_USER_ID="paras"
$env:CODEFORGE_MODEL="deepseek-v4-flash"
```

3. Run terminal UI:

```bash
npm run dev:terminal
```

## 3.5 Run desktop app (optional)

1. Ensure Rust toolchain is installed.
2. From repo root:

```bash
npm run dev:desktop
```

3. If prompted by Tauri tooling requirements, install prerequisites and rerun.

## 3.6 Run VS Code extension (optional)

1. Open repo in VS Code.
2. Ensure API is already running on port 8000.
3. Press F5 in VS Code to launch Extension Development Host.
4. In the extension host, run command:

- CodeForge: Open Panel

5. Login with dev user and test actions.

## 3.7 Local smoke test checklist

1. API health endpoint works.
2. Web loads and can call dev-login/session endpoints.
3. Terminal app can login and list/create sessions.
4. Desktop app launches and reaches API.
5. VS Code panel opens and communicates with API.

## 4) Production Architecture on AWS (Recommended)

Use this target architecture for reliability and scale:

1. VPC with public/private subnets (2 AZ minimum)
2. RDS PostgreSQL (private subnets)
3. ECS Fargate service for API (private subnets)
4. ECS Fargate service for Web (private subnets)
5. Application Load Balancer (public) routing:
   - api.yourdomain.com -> API target group
   - app.yourdomain.com -> Web target group
6. ACM TLS certificate
7. Route53 DNS records
8. Secrets Manager / SSM Parameter Store for secrets
9. CloudWatch logs + alarms

## 5) Prepare App for AWS Deployment

This repo currently has no Dockerfiles or CI pipeline committed. Create these first.

## 5.1 Create API Dockerfile (services/api/Dockerfile)

```dockerfile
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 5.2 Create Web Dockerfile (apps/web/Dockerfile)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build:web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 3000
CMD ["npm", "run", "start:web"]
```

## 5.3 Decide production environment values

Minimum API env vars for production:

1. DATABASE_URL=postgresql://...
2. SUPABASE_JWT_SECRET=...
3. RAZORPAY_KEY_ID=...
4. RAZORPAY_KEY_SECRET=...
5. OTEL_SERVICE_NAME=codeforge-api
6. OTEL_ENVIRONMENT=production
7. OTEL_EXPORTER_OTLP_ENDPOINT=... (optional, if using OTLP collector)
8. OPENAI_API_KEY=... (if synthesis path uses OpenAI provider)
9. OPENAI_BASE_URL=...
10. CODEFORGE_SYNTHESIS_MODEL=...

Web env vars (build/runtime):

1. NEXT_PUBLIC_API_BASE=https://api.yourdomain.com

Client app env updates after deployment:

1. CODEFORGE_API_BASE_URL=https://api.yourdomain.com (terminal, desktop, VS Code)
2. VITE_CODEFORGE_API_BASE_URL=https://api.yourdomain.com (desktop)

## 6) AWS Deployment Step-by-Step (ECS + RDS + ALB)

## 6.1 Create networking

1. Create VPC (or use existing).
2. Create at least 2 public and 2 private subnets across different AZs.
3. Attach Internet Gateway to VPC.
4. Create NAT Gateway in public subnet for private subnet egress.
5. Configure route tables:
   - public subnets -> IGW
   - private subnets -> NAT

## 6.2 Create security groups

1. ALB SG:
   - inbound 80/443 from internet
   - outbound to ECS SG
2. ECS SG:
   - inbound 8000 (API) from ALB SG
   - inbound 3000 (Web) from ALB SG
   - outbound to RDS + internet (via NAT)
3. RDS SG:
   - inbound 5432 from ECS SG only

## 6.3 Create PostgreSQL RDS

1. Engine: PostgreSQL (supported stable version)
2. Instance class: start with db.t4g.small or above
3. Multi-AZ: enable for production
4. Private subnets only
5. Attach RDS SG
6. Save endpoint, db name, user, password securely

Build DATABASE_URL:

```text
postgresql://DB_USER:DB_PASSWORD@RDS_ENDPOINT:5432/DB_NAME
```

## 6.4 Create ECR repositories

Create two repos:

1. codeforge-api
2. codeforge-web

## 6.5 Build and push container images

From repo root:

1. Authenticate Docker to ECR.
2. Build/push API image.
3. Build/push Web image with NEXT_PUBLIC_API_BASE build argument.

Example command pattern (replace placeholders):

```bash
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com

docker build -t codeforge-api:latest services/api
docker tag codeforge-api:latest <account>.dkr.ecr.<region>.amazonaws.com/codeforge-api:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/codeforge-api:latest

docker build -t codeforge-web:latest -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_BASE=https://api.yourdomain.com .
docker tag codeforge-web:latest <account>.dkr.ecr.<region>.amazonaws.com/codeforge-web:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/codeforge-web:latest
```

## 6.6 Create ECS cluster and task definitions

1. Create ECS cluster (Fargate).
2. Create task definition for API:
   - container port 8000
   - CPU/memory per expected load
   - env vars from SSM/Secrets Manager
   - CloudWatch log group
3. Create task definition for Web:
   - container port 3000
   - NEXT_PUBLIC_API_BASE env var
   - CloudWatch log group

## 6.7 Create ALB and target groups

1. Create ALB in public subnets.
2. Create target group for API (port 8000, health check: /health).
3. Create target group for Web (port 3000, health check: /).
4. Create listeners:
   - HTTP 80 -> redirect to HTTPS 443
   - HTTPS 443 with ACM cert
5. Add host-based rules:
   - api.yourdomain.com -> API target group
   - app.yourdomain.com -> Web target group

## 6.8 Create ECS services

1. API ECS service:
   - desired tasks >= 2 (for HA)
   - private subnets
   - attach API target group
2. Web ECS service:
   - desired tasks >= 2
   - private subnets
   - attach Web target group

## 6.9 Configure DNS

In Route53:

1. Create A/AAAA alias api.yourdomain.com -> ALB
2. Create A/AAAA alias app.yourdomain.com -> ALB

## 6.10 Validate production deployment

1. Check API health:

```bash
curl https://api.yourdomain.com/health
```

2. Open web app:

- https://app.yourdomain.com

3. Perform end-to-end flow:
   - dev login
   - create/list sessions
   - send/stream message
   - usage summary

## 7) Quick Alternative: Single EC2 Deployment (Lower Cost, Not Ideal for Scale)

Use when you need a fast staging/prototype cloud setup.

## 7.1 Launch EC2

1. Ubuntu 22.04/24.04 instance
2. Open SG ports 22, 80, 443
3. SSH into instance

## 7.2 Install dependencies

Install:

1. Node.js 20
2. Python 3.13 + venv
3. Nginx
4. PM2 (for process management)
5. Certbot (TLS)

## 7.3 Deploy source and run processes

1. Clone repo.
2. Setup API venv + pip install requirements.
3. Run API with uvicorn on localhost:8000 via PM2/systemd.
4. Build and start web app on localhost:3000 via PM2.
5. Configure Nginx reverse proxy:
   - /api -> localhost:8000
   - / -> localhost:3000
6. Enable HTTPS using Certbot.

## 7.4 Configure production environment variables

Set all API secrets (DATABASE_URL, JWT/payment/model keys) using:

1. systemd Environment entries, or
2. secure environment files with restricted permissions

## 8) Production Readiness Checklist (Must Do)

## 8.1 Security

1. Enforce HTTPS everywhere.
2. Restrict CORS to trusted domains (replace wildcard).
3. Move all secrets to Secrets Manager/SSM.
4. Lock down security groups with least privilege.
5. Enable WAF (recommended) on ALB.

## 8.2 Reliability

1. Run at least 2 API tasks and 2 web tasks across AZs.
2. Use RDS Multi-AZ.
3. Add health checks and auto-restart policies.
4. Add autoscaling policies for ECS services.

## 8.3 Observability

1. Send app logs to CloudWatch.
2. Add CloudWatch alarms:
   - 5xx error rate
   - ECS CPU/memory saturation
   - RDS CPU/connections/storage
3. Keep OpenTelemetry enabled in production.

## 8.4 Data and backup

1. Enable automated RDS backups.
2. Define backup retention policy.
3. Test restore process quarterly.

## 8.5 Performance and scale

1. Load test API before launch.
2. Tune ECS CPU/memory and concurrency.
3. Use PostgreSQL in production (not SQLite).

## 8.6 Operations

1. Versioned releases (tag images by commit SHA).
2. Blue/green or rolling deployments.
3. Rollback plan documented and tested.
4. Incident runbook and on-call alerts.

## 9) CI/CD Recommendation

Use GitHub Actions (or CodePipeline) with this flow:

1. On push to main:
   - run lint/build/tests
   - run rollout policy gate (must pass synthesis readiness checks)
   - build API and web images
   - push to ECR
2. Deploy to staging ECS service
3. Run smoke tests
4. Manual approval
5. Deploy to production ECS services

### 9.1 Rollout policy gate inputs (required)

Configure these GitHub settings so deployment promotion is blocked when synthesis rollout is not ready:

Required repository variables:

1. CODEFORGE_SYNTHESIS_PROVIDER_STAGING (recommended: auto, openai, or azure_openai)
2. CODEFORGE_SYNTHESIS_PROVIDER_PRODUCTION (required value: azure_openai)

Required staging secrets:

1. SYNTHESIS_OPENAI_API_KEY_STAGING (required if staging provider uses openai)
2. SYNTHESIS_AZURE_OPENAI_ENDPOINT_STAGING
3. SYNTHESIS_AZURE_OPENAI_API_KEY_STAGING
4. SYNTHESIS_AZURE_OPENAI_DEPLOYMENT_STAGING

Required production secrets:

1. SYNTHESIS_AZURE_OPENAI_ENDPOINT_PRODUCTION
2. SYNTHESIS_AZURE_OPENAI_API_KEY_PRODUCTION
3. SYNTHESIS_AZURE_OPENAI_DEPLOYMENT_PRODUCTION

## 10) Post-Deployment Client Configuration

After cloud deployment, update client apps to production API URL:

1. Terminal app:

```text
CODEFORGE_API_BASE_URL=https://api.yourdomain.com
```

2. Desktop app:

```text
VITE_CODEFORGE_API_BASE_URL=https://api.yourdomain.com
```

3. VS Code extension:

- Set panel base URL to production API endpoint (if configurable in panel state/settings).

## 11) Go-Live Sequence (Recommended)

1. Deploy staging on AWS.
2. Complete smoke + regression checks.
3. Run load test and validate alarms.
4. Enable production domain and TLS.
5. Deploy production.
6. Verify user journeys and logs.
7. Monitor closely for first 24-48 hours.

## 12) Troubleshooting Quick Map

1. API not reachable:
   - check ECS task health, ALB target health, SG rules, container logs
2. Web loads but API calls fail:
   - verify NEXT_PUBLIC_API_BASE and ALB host routing
3. Auth issues:
   - verify SUPABASE_JWT_SECRET and token format
4. DB connection errors:
   - verify DATABASE_URL, RDS SG ingress, subnet routing, credentials
5. Missing traces:
   - verify OTEL vars and exporter endpoint

---

If you want, next step I can generate the missing deployment assets directly in this repo (Dockerfiles, docker-compose for local prod-like testing, and a GitHub Actions workflow for ECS deployment) so this runbook becomes fully executable with minimal manual setup.