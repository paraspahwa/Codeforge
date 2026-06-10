# CodeForge Terraform (ALB + TLS skeleton)

This folder provides a minimal edge stack for ECS services: one internet-facing ALB, HTTPS listener, HTTP→HTTPS redirect, and separate target groups for API (`8000`) and web (`3000`).

## Prerequisites

- Terraform >= 1.5
- Existing VPC with public subnets (ALB) and private subnets (ECS tasks)
- ACM certificate ARN covering web + API hostnames

## Layout

- `modules/edge/` — reusable ALB module (HTTPS, target groups)
- `modules/ecs-service/` — Fargate service wired to a target group (ignores task definition drift from CI)
- `modules/ecs-worker-service/` — Celery worker Fargate service (no ALB)
- `modules/efs-access/` — NFS ingress rules from worker task SGs to EFS
- `modules/ecs-qdrant-service/` — Qdrant Fargate + Cloud Map private DNS
- `modules/qdrant-access/` — TCP 6333 from API/worker SGs to Qdrant
- `environments/staging/` — staging ALB + optional ECS/EFS wiring
- `environments/production/` — production mirror with CI-aligned service names

## Usage (staging or production)

```bash
cd infra/terraform/environments/staging   # or production
cp terraform.tfvars.example terraform.tfvars
# edit vpc_id, subnet ids, certificate_arn, cluster/task ARNs

terraform init
terraform plan
terraform apply
```

Service names default to match `.github/workflows/deploy-ecs.yml` (`api_service_name`, `web_service_name`, `worker_service_name`).

Outputs include:

- `alb_dns_name` — create Route53 alias records for web/API hostnames
- `api_target_group_arn` / `web_target_group_arn` — attach to ECS services
- `api_service_name` / `web_service_name` / `worker_service_name` — when `enable_ecs_services = true`
- `efs_security_group_id` — attach to EFS mount targets when the module creates the SG

## Two-phase apply runbook

Terraform manages the ALB edge and (optionally) ECS services. GitHub Actions registers new task definition revisions on each deploy. Use this order:

### Phase 1 — Edge only

1. `cd infra/terraform/environments/staging` (or `production`)
2. `cp terraform.tfvars.example terraform.tfvars` and fill VPC, subnets, `certificate_arn`, `cluster_arn`
3. Leave `enable_ecs_services = false`
4. `terraform init && terraform apply`
5. Create Route53 alias records: web + API hostnames → `alb_dns_name` output

### Phase 2 — First image deploy (GitHub Actions)

1. Set GitHub variables: `WEB_PUBLIC_URL_*`, `NEXT_PUBLIC_API_BASE_*`, `EFS_FILE_SYSTEM_ID_*`
2. Bootstrap SSM: Razorpay (`scripts/bootstrap_razorpay_ssm.py`), OIDC (`scripts/bootstrap_oidc_ssm.py`), Qdrant (`scripts/bootstrap_qdrant_ssm.py`)
3. Run workflow deploy (push to `main` for staging, manual dispatch for production)
4. Fetch task definition ARNs:

```bash
aws ecs describe-task-definition --task-definition codeforge-api-staging-task \
  --query 'taskDefinition.taskDefinitionArn' --output text
aws ecs describe-task-definition --task-definition codeforge-worker-staging-task \
  --query 'taskDefinition.taskDefinitionArn' --output text
```

### Phase 3 — Wire ECS services in Terraform

1. Copy `terraform.tfvars.phase3.example` → `terraform.tfvars` (or set in `terraform.tfvars`):
   - `enable_ecs_services = true`
   - `api_task_definition_arn`, `web_task_definition_arn`, `worker_task_definition_arn`
   - `efs_file_system_id` (match GitHub `EFS_FILE_SYSTEM_ID_*`)
2. `terraform apply` — creates Fargate services registered to ALB target groups + worker/EFS access
3. Subsequent deploys: GitHub Actions updates task revisions; Terraform ignores `task_definition` drift

Post-deploy verification: `bash scripts/post_deploy_public_smoke.sh <api-url> <web-url>`

## ECS service attachment

Set `enable_ecs_services = true` in `terraform.tfvars` after the first API/web task definition revisions exist. The `ecs-service` module creates Fargate services with ALB target group registration; GitHub Actions can keep deploying new task definition revisions (Terraform ignores `task_definition` drift).

Manual attachment (if `enable_ecs_services = false`). Health checks:

- API: `GET /health` on port `8000`
- Web: `GET /` on port `3000`

Pair with [production-domains.md](../../docs/production-domains.md) and GitHub `WEB_PUBLIC_URL_*` variables used by the deploy workflow.

## Worker + EFS

When `enable_ecs_services = true`, set `worker_task_definition_arn` and `efs_file_system_id` in `terraform.tfvars` (match `EFS_FILE_SYSTEM_ID_STAGING` from GitHub). `worker.tf` provisions:

- `ecs-worker-service` — Fargate worker with no ALB
- `efs-access` — NFS TCP 2049 from worker task SG to EFS SG

If EFS already has a security group, pass `efs_security_group_id`; otherwise the module creates one (attach its output to EFS mount targets).

## Qdrant (optional self-hosted)

Set `enable_qdrant_service = true` with `qdrant_task_definition_arn` (from `infra/ecs/*/taskdef-qdrant.json` after first deploy). Terraform outputs `qdrant_url` (e.g. `http://qdrant.codeforge-staging.local:6333`). Bootstrap SSM:

```bash
python scripts/bootstrap_qdrant_ssm.py --environment staging --internal-url "$(terraform output -raw qdrant_url)"
```

See [docs/qdrant-ecs-setup.md](../../docs/qdrant-ecs-setup.md).
