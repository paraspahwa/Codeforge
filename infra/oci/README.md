# OCI Infrastructure (Primary)

OCI Container Instance JSON configs for deploying CodeForge serverlessly on Oracle Cloud.

- `staging/` — Staging environment configs
- `production/` — Production environment configs

Each file uses `${VARIABLE}` placeholders resolved at deploy time via `envsubst`.

See [docs/OCI_DEPLOYMENT_GUIDE.md](../../docs/OCI_DEPLOYMENT_GUIDE.md) for setup instructions.
