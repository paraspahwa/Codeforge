# Deployment Assets Setup Guide

This file explains how to use the generated deployment assets in this repo.

## Files Added

1. `.dockerignore`
2. `services/api/Dockerfile`
3. `apps/web/Dockerfile`
4. `docker-compose.prod.yml`
5. `infra/ecs/taskdef-api.json`
6. `infra/ecs/taskdef-web.json`
7. `.github/workflows/deploy-ecs.yml`
8. `infra/ecs/staging/taskdef-api.json`
9. `infra/ecs/staging/taskdef-web.json`
10. `infra/ecs/production/taskdef-api.json`
11. `infra/ecs/production/taskdef-web.json`
12. `infra/ecs/staging/taskdef-worker.json`
13. `infra/ecs/production/taskdef-worker.json`

## Local production-like run with Docker Compose

Run from repo root:

```bash
docker compose -f docker-compose.prod.yml up --build
```

Check services:

1. API: <http://localhost:8000/health>
2. Web: <http://localhost:3000>

Stop services:

```bash
docker compose -f docker-compose.prod.yml down
```

Stop and remove DB volume:

```bash
docker compose -f docker-compose.prod.yml down -v
```

## Prepare ECS task definitions before first deploy

Update these values in all environment task definition files:

1. AWS account ID (`111111111111` placeholders)
2. Region (`ap-south-1` if different)
3. IAM role ARNs (`executionRoleArn`, `taskRoleArn`)
4. SSM parameter ARNs in API task definitions
5. `NEXT_PUBLIC_API_BASE` in web task definition

Environment-specific files:

1. Staging:
   - `infra/ecs/staging/taskdef-api.json`
   - `infra/ecs/staging/taskdef-web.json`
   - `infra/ecs/staging/taskdef-worker.json`
2. Production:
   - `infra/ecs/production/taskdef-api.json`
   - `infra/ecs/production/taskdef-web.json`
   - `infra/ecs/production/taskdef-worker.json`

## Configure GitHub repository secrets and variables

Required repository secrets (OIDC role assumption):

1. `AWS_ROLE_TO_ASSUME_STAGING`
2. `AWS_ROLE_TO_ASSUME_PRODUCTION`

Required repository variables:

1. `NEXT_PUBLIC_API_BASE_STAGING` (example: `https://api-staging.yourdomain.com`)
2. `NEXT_PUBLIC_API_BASE_PRODUCTION` (example: `https://api.yourdomain.com`)

Notes:

1. The workflow now uses GitHub OIDC (`id-token: write`) and does not require long-lived AWS access keys.
2. Configure trust policy on both AWS IAM roles to trust your GitHub org/repo and branch/environment conditions.

## Configure ECS resources to match workflow

The workflow expects these names by default:

1. Staging cluster: `codeforge-staging`
2. Staging API service: `codeforge-api-staging-service`
3. Staging Web service: `codeforge-web-staging-service`
4. Staging Worker service: `codeforge-worker-staging-service`
5. Production cluster: `codeforge-prod`
6. Production API service: `codeforge-api-service`
7. Production Web service: `codeforge-web-service`
8. Production Worker service: `codeforge-worker-service`
9. ECR repos: `codeforge-api`, `codeforge-web`

The worker ECS service reuses the API image and runs `celery worker --beat` so scheduled cowork jobs tick outside the API process. Set `CODEFORGE_COWORK_SCHEDULER_ENABLED=false` on API tasks in production.

Before the first worker deploy, create the ECS services in each cluster (Fargate, awsvpc, desired count >= 1) and CloudWatch log groups `/ecs/codeforge-worker-staging` and `/ecs/codeforge-worker-prod`.

If your names differ, update `.github/workflows/deploy-ecs.yml` env section.

## Deployment trigger

Deployment runs on:

1. Push to `main` -> smoke test + staging deployment
2. Manual run via GitHub Actions `workflow_dispatch`
   - select `staging` or `production`

## CI smoke test gate

Before deployment, CI now runs a smoke-test stage:

1. `docker compose -f docker-compose.prod.yml up -d --build`
2. API health probe: `http://127.0.0.1:8000/health`
3. Web health probe: `http://127.0.0.1:3000`
4. On completion/failure, stack is torn down automatically

## Recommended next improvements

1. Add test/lint build gates before deploy steps.
2. Add environment protection rules in GitHub for production approvals.
3. Add post-deploy synthetic checks against staging/production URLs.
