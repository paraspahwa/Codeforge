# CodeForge — OCI Deployment Guide

Step-by-step guide to deploying CodeForge on **Oracle Cloud Infrastructure (OCI)** using Container Instances (serverless Docker, like AWS Fargate), OCI Load Balancer, OCI Vault for secrets, OCIR for images, and optional OCI File Storage Service (FSS) for worker volumes.

**Estimated cost:** ₹1,500–5,000/mo ($18–60/mo) depending on shape size — significantly cheaper than AWS ECS.

## 1. Architecture

```
Cloudflare DNS
     ↓
OCI Load Balancer (public, HTTPS)
     ├── /api/* → API Container Instance (port 8000)
     └── / → Web Container Instance (port 3000)
                          Worker Container Instance (Celery, internal)
                              ↓
                    OCI File Storage (FSS, optional) / OCI Vault (secrets)
                    Redis (Upstash) / Qdrant Cloud / Supabase (DB)
```

## 2. Prerequisites

| Resource | How to get it |
|----------|---------------|
| **OCI Account** | Sign up at cloud.oracle.com (free tier includes Always Free resources) |
| **Domain** | Any domain; Cloudflare free plan for DNS |
| **Supabase** | Free tier for Postgres; `DATABASE_URL` with `?sslmode=require` |
| **Upstash Redis** | Free tier; `REDIS_URL` |
| **Qdrant Cloud** | Free 1GB cluster; `QDRANT_URL` |
| **Razorpay** | Test/live keys for INR billing |
| **OpenAI API Key** | Required for real AI features |
| **OCI CLI** | Installed locally or in CI |

## 3. OCI Resource Setup (one-time)

### 3.1 Create a Compartment
```bash
oci iam compartment create \
  --compartment-id $TENANCY_OCID \
  --name CodeForge \
  --description "CodeForge resources"
```

### 3.2 Create VCN and Subnets
```bash
# Create VCN
oci network vcn create \
  --compartment-id $COMPARTMENT_ID \
  --display-name codeforge-vcn \
  --cidr-block 10.0.0.0/16

# Create public subnet (for load balancer)
oci network subnet create \
  --compartment-id $COMPARTMENT_ID \
  --vcn-id $VCN_ID \
  --display-name codeforge-public \
  --cidr-block 10.0.1.0/24

# Create private subnet (for container instances)
oci network subnet create \
  --compartment-id $COMPARTMENT_ID \
  --vcn-id $VCN_ID \
  --display-name codeforge-private \
  --cidr-block 10.0.2.0/24
```

### 3.3 Create a Vault and Encryption Key
```bash
oci vault vault create \
  --compartment-id $COMPARTMENT_ID \
  --display-name codeforge-vault \
  --vault-type VIRTUAL_PRIVATE

oci vault key create \
  --compartment-id $COMPARTMENT_ID \
  --display-name codeforge-key \
  --key-shape AES \
  --key-shape-length 32 \
  --protection-mode SOFTWARE
```

### 3.4 Create OCIR Repositories
```bash
oci artifacts container repository create \
  --compartment-id $COMPARTMENT_ID \
  --display-name codeforge-api \
  --is-public false

oci artifacts container repository create \
  --compartment-id $COMPARTMENT_ID \
  --display-name codeforge-web \
  --is-public false

oci artifacts container repository create \
  --compartment-id $COMPARTMENT_ID \
  --display-name codeforge-worker \
  --is-public false
```

### 3.5 Load Certificate into OCI
Upload your SSL certificate (or use OCI Certificates service):
```bash
oci certificates certificate-authority create ... # or use OCI Load Balancer cert
```

### 3.6 Bootstrap Secrets into Vault
```bash
python scripts/bootstrap_oci_vault.py \
  --environment staging \
  --vault-id $VAULT_OCID \
  --compartment-id $COMPARTMENT_ID \
  --key-id $KEY_OCID \
  --env-file .env.production
```

## 4. Terraform Infrastructure (Recommended)

### 4.1 Create terraform.tfvars
Create `infra/terraform/oci/environments/production/terraform.tfvars`:

```hcl
oci_region          = "ap-mumbai-1"
compartment_id      = "ocid1.compartment.oc1..xxxxx"
vcn_id              = "ocid1.vcn.oc1..xxxxx"
public_subnet_ids   = ["ocid1.subnet.oc1..xxxxx"]
private_subnet_id   = "ocid1.subnet.oc1..xxxxx"
availability_domain = "aPjD:AP-MUMBAI-1-AD-1"
certificate_name    = "codeforge-cert"
api_hostname        = "api.codeforge.example"
api_image           = "ocir.io/.../codeforge-api:latest"
web_image           = "ocir.io/.../codeforge-web:latest"
worker_image        = "ocir.io/.../codeforge-worker:latest"
enable_container_instances = true
```

### 4.2 Apply
```bash
cd infra/terraform/oci/environments/production
terraform init
terraform plan
terraform apply
```

Outputs: Load balancer IP, NSG IDs for each service.

## 5. GitHub Actions CI/CD

### 5.1 Required Secrets

| Secret | Description |
|--------|-------------|
| `OCI_CLI_USER` | OCI user OCID |
| `OCI_CLI_FINGERPRINT` | API key fingerprint |
| `OCI_TENANCY_OCID` | Tenancy OCID |
| `OCI_API_KEY` | Private key contents (PEM) |
| `OCI_REGION` | e.g. `ap-mumbai-1` |
| `OCIR_REGISTRY` | e.g. `ocir.io/tenancy/codeforge` |
| `OCIR_AUTH_TOKEN` | OCIR auth token |
| `OCI_USERNAME` | Username for OCIR login |
| `OCI_COMPARTMENT_ID` | CodeForge compartment OCID |
| `OCI_AVAILABILITY_DOMAIN` | AD name |
| `OCI_PRIVATE_SUBNET_ID` | Private subnet OCID |

### 5.2 Required Variables

| Variable | Description |
|----------|-------------|
| `API_PUBLIC_URL_STAGING` | `https://api-staging.example.com` |
| `API_PUBLIC_URL_PRODUCTION` | `https://api.example.com` |
| `WEB_PUBLIC_URL_STAGING` | `https://staging.example.com` |
| `WEB_PUBLIC_URL_PRODUCTION` | `https://app.example.com` |
| `OCI_API_NSG_ID_STAGING` | NSG OCID from Terraform output |
| `OCI_API_NSG_ID_PRODUCTION` | Same for production |
| `OCI_WEB_NSG_ID_STAGING` | Web NSG OCID |
| `OCI_WEB_NSG_ID_PRODUCTION` | Same for production |
| `OCI_WORKER_NSG_ID_STAGING` | Worker NSG OCID |
| `OCI_WORKER_NSG_ID_PRODUCTION` | Same for production |

## 6. Quickest Path (Single Compute VM)

For MVP, skip Container Instances and run on a single OCI compute VM:

1. Launch an **Ubuntu 24.04 ARM VM** (VM.Standard.A1.Flex — 4 OCPU, 24 GB free) in your compartment
2. SSH in and run:
```bash
git clone https://github.com/paraspahwa/Codeforge.git
cd Codeforge
docker compose -f docker-compose.prod.yml up -d --build
```
3. Open port 3000 and 8000 in the security list / NSG
4. Point Cloudflare DNS records to the VM's public IP
5. For HTTPS, either use Cloudflare's proxy (orange cloud) or set up Caddy/Nginx on the VM

This costs **$0/mo on OCI Always Free tier** — the cheapest path.

## 7. Production Checklist

- [ ] `CODEFORGE_ENV=production` set on all containers
- [ ] `CODEFORGE_ALLOW_DEV_LOGIN=false` in production
- [ ] OIDC enabled with `CODEFORGE_OIDC_ENABLED=true`
- [ ] CORS set to specific web origin: `CODEFORGE_CORS_ORIGINS=https://app.yourdomain.com`
- [ ] Secrets in OCI Vault (run `scripts/bootstrap_oci_vault.py`)
- [ ] Razorpay webhook registered at `https://api.yourdomain.com/api/v1/billing/webhook`
- [ ] `GET /api/v1/platform/deploy-readiness` returns `"ready": true`
- [ ] Worker container running with `CODEFORGE_COWORK_SCHEDULER_ENABLED=false` on API
- [ ] Workspace volume mounted (FSS or host bind)

## 8. Cost Breakdown (OCI)

| Service | Cost |
|---------|------|
| Compute (A1.Flex, 4 OCPU) | **Free** (Always Free) |
| Compute (E4.Flex, 1 OCPU) | ~₹600/mo |
| Load Balancer (10 Mbps) | ~₹750/mo |
| Container Instances | ~₹500–1000/mo |
| OCIR (container registry) | **Free** (10 GB) |
| Vault (secrets) | ~₹50/mo |
| File Storage (100 GB) | ~₹150/mo |
| **Total (single VM)** | **$0/mo** |
| **Total (fully managed)** | **~$18–60/mo** |
