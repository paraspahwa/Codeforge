# Qdrant on ECS

CodeForge uses Qdrant for context/RAG vector storage. Local `docker-compose.prod.yml` runs Qdrant as a sidecar; ECS tasks read `QDRANT_URL` from SSM.

## SSM parameters

| Environment | SSM path |
|-------------|----------|
| Staging | `/codeforge/staging/QDRANT_URL` |
| Production | `/codeforge/prod/QDRANT_URL` |

Bootstrap:

```bash
cp .env.qdrant.example .env.qdrant
# set QDRANT_URL to your cluster endpoint

python scripts/bootstrap_qdrant_ssm.py --environment staging --env-file .env.qdrant
```

## Hosting options

1. **Qdrant Cloud** — fastest path; use the HTTPS cluster URL from the dashboard.
2. **Dedicated Fargate service (Terraform)** — `enable_qdrant_service = true` in `infra/terraform/environments/*/terraform.tfvars` wires `modules/ecs-qdrant-service` + `qdrant-access` (Cloud Map DNS + TCP 6333 from API/worker tasks). Task definition: `infra/ecs/*/taskdef-qdrant.json`.
3. **ECS sidecar** — colocate Qdrant in the API task (simple for staging, not recommended for production HA).

API and worker task definitions already reference `QDRANT_URL` from SSM (`infra/ecs/*/taskdef-api.json`, `taskdef-worker.json`).

## Vector dimensions

When `OPENAI_API_KEY` is set, embeddings use `text-embedding-3-small` (1536 dimensions). Set `QDRANT_VECTOR_SIZE=1536` explicitly if needed. The API recreates the collection when the configured size changes.

## Verification

```bash
curl -fsS "https://api-staging.yourdomain.com/api/v1/platform/deploy-readiness?probe_vector=true"
curl -fsS https://api-staging.yourdomain.com/api/v1/platform/stack-status
```

`stack-status` should report `vector_store.backend: qdrant` and `healthy: true`.

Pair with [production-domains.md](production-domains.md) and post-deploy `scripts/post_deploy_public_smoke.sh`.
