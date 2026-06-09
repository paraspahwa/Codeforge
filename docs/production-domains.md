# Production Domains and TLS

This guide covers public URL wiring for ECS deployments. TLS termination happens at the load balancer (ALB); ECS tasks run HTTP internally.

## 0. Terraform ALB skeleton (optional)

A minimal edge stack lives in `infra/terraform/` (ALB, HTTPS listener, API host routing, target groups). Apply it before attaching ECS services:

```bash
cd infra/terraform/environments/staging
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
```

## 1. DNS and certificates

1. Request an ACM certificate in the deployment region for:
   - `staging.yourdomain.com`
   - `api-staging.yourdomain.com`
   - `yourdomain.com`
   - `api.yourdomain.com`
2. Create Route53 (or external DNS) `A`/`AAAA` alias records pointing to the ALB for web and API hostnames.
3. Configure ALB listeners:
   - `443` → HTTPS target groups (web `:3000`, API `:8000`)
   - `80` → redirect to `443`

## 2. GitHub repository variables

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_STAGING` | `https://api-staging.yourdomain.com` |
| `NEXT_PUBLIC_API_BASE_PRODUCTION` | `https://api.yourdomain.com` |
| `WEB_PUBLIC_URL_STAGING` | `https://staging.yourdomain.com` |
| `WEB_PUBLIC_URL_PRODUCTION` | `https://yourdomain.com` |

The deploy workflow patches ECS task definitions before registration:

- API `CODEFORGE_WEB_BASE_URL` ← `WEB_PUBLIC_URL_*` (OIDC redirect defaults)
- Web `NEXT_PUBLIC_API_BASE` ← `NEXT_PUBLIC_API_BASE_*` (runtime env mirror; image build uses the same var)

Local dry run:

```bash
python scripts/patch_ecs_public_urls.py \
  --environment staging \
  --web-url https://staging.yourdomain.com \
  --api-url https://api-staging.yourdomain.com
```

## 3. OIDC redirect alignment

Set SSM `CODEFORGE_OIDC_REDIRECT_URI` to `{WEB_PUBLIC_URL}/auth/callback` for each environment and register the same URI at your IdP (see [oidc-idp-checklist.md](oidc-idp-checklist.md)).

## 4. Post-deploy verification

Automated in `.github/workflows/deploy-ecs.yml` via `scripts/post_deploy_public_smoke.sh` after each ECS deploy.

Manual checks:

```bash
bash scripts/post_deploy_public_smoke.sh \
  https://api-staging.yourdomain.com \
  https://staging.yourdomain.com
```

Or individually:

```bash
curl -fsS "https://api-staging.yourdomain.com/api/v1/platform/deploy-readiness?probe_discovery=true&probe_billing=true"
curl -I https://staging.yourdomain.com
```

Ensure deploy readiness passes after OIDC and Razorpay SSM parameters are populated (see [razorpay-webhook-setup.md](razorpay-webhook-setup.md)).

## 5. Worker + EFS

Worker tasks mount EFS at `/workspaces` (see `infra/ecs/staging/taskdef-worker.json`). Terraform `modules/efs-access` opens NFS (TCP 2049) from the worker task security group to the EFS security group. Set `efs_file_system_id` in staging `terraform.tfvars` to match `EFS_FILE_SYSTEM_ID_STAGING` used by the GitHub deploy workflow.
