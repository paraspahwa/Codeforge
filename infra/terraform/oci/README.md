# OCI Terraform (Primary)

OCI Terraform modules for CodeForge infrastructure.

**This is the primary IaC path.** The AWS Terraform under `../terraform/` (non-oci directory) is deprecated.

## Modules

- `modules/edge/` — OCI Load Balancer, listener, backend sets, NSG
- `modules/container-instance/` — OCI Container Instance with LB integration
- `modules/fss-access/` — OCI File Storage NSG rules for worker volumes

## Environments

- `environments/staging/` — Staging deployment
- `environments/production/` — Production deployment

## Usage

```bash
cd infra/terraform/oci/environments/production
terraform init
terraform plan
terraform apply
```

See [docs/OCI_DEPLOYMENT_GUIDE.md](../../../../docs/OCI_DEPLOYMENT_GUIDE.md) for required variables.
