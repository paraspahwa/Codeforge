# OIDC IdP Registration Checklist

Use this checklist when enabling `CODEFORGE_OIDC_ENABLED=true` in staging or production.

## 1. Create the OIDC application at your IdP

Configure a confidential web client (authorization code flow) with:

- Scopes: `openid profile email` (or match `CODEFORGE_OIDC_SCOPES`)
- Grant type: authorization code
- PKCE: optional for server-side web callback; desktop/terminal/VS Code use paste-code completion

## 2. Register redirect URIs

| Surface | Redirect URI |
|---------|----------------|
| Web (local) | `http://localhost:3000/auth/callback` |
| Web (staging) | `https://<staging-web-domain>/auth/callback` |
| Web (production) | `https://<production-web-domain>/auth/callback` |
| Desktop | `http://localhost:1420/auth/callback` |
| Terminal | `http://127.0.0.1:4583/auth/callback` |
| VS Code panel | `http://127.0.0.1:4584/auth/callback` |

The API stores the primary web redirect in `CODEFORGE_OIDC_REDIRECT_URI` (SSM). Client-specific URIs are passed to `/api/v1/auth/oidc/authorize-url` and must still be allow-listed at the IdP.

## 3. Populate SSM parameters

ECS API task definitions read these paths (staging example):

- `/codeforge/staging/CODEFORGE_OIDC_ISSUER`
- `/codeforge/staging/CODEFORGE_OIDC_AUDIENCE`
- `/codeforge/staging/CODEFORGE_OIDC_JWKS_URI`
- `/codeforge/staging/CODEFORGE_OIDC_CLIENT_ID`
- `/codeforge/staging/CODEFORGE_OIDC_CLIENT_SECRET` (SecureString)
- `/codeforge/staging/CODEFORGE_OIDC_REDIRECT_URI`

Production uses `/codeforge/prod/CODEFORGE_OIDC_*` (not `codeforge/production`).

Bootstrap helper (requires AWS CLI credentials):

```bash
# Copy .env.oidc.example to .env.oidc and fill values
python scripts/bootstrap_oidc_ssm.py --environment staging --env-file .env.oidc

# Print redirect checklist only
python scripts/bootstrap_oidc_ssm.py --print-checklist
```

## 4. Enable OIDC on API tasks

After SSM parameters exist and redirect URIs are registered at the IdP:

```bash
python scripts/patch_ecs_oidc_enabled.py --environment staging --enabled true
# commit taskdef change, deploy via GitHub Actions
```

Non-secret env on the API container:

- `CODEFORGE_OIDC_ENABLED=true`
- `CODEFORGE_OIDC_TRUST_SUBJECT=false` (use code exchange) or `true` for JWT bearer trust

Production cutover: repeat for `--environment production` after staging SSO is validated.

## 5. Verify before deploy

```bash
curl http://localhost:8000/api/v1/platform/deploy-readiness
curl "http://localhost:8000/api/v1/platform/deploy-readiness?probe_discovery=true"
curl http://localhost:8000/api/v1/auth/oidc/config
python scripts/verify_oidc_cutover_readiness.py --api-base https://api-staging.yourdomain.com
```

Do not set `CODEFORGE_ALLOW_DEV_LOGIN` in production ECS tasks after OIDC is enabled.

CI fails closed when deploy readiness reports missing required OIDC configuration while OIDC is enabled.

## Razorpay webhook events

Register `https://<api-host>/api/v1/billing/webhook` for:

- `payment.captured`, `payment.authorized`, `order.paid` — activate subscription and optional org upgrade
- `payment.failed` — mark order failed
- `subscription.cancelled`, `subscription.halted`, `subscription.completed`, `subscription.paused` — lapse subscription and downgrade owned orgs to `lite`
- `subscription.charged`, `subscription.activated`, `subscription.resumed`, `subscription.updated` — renew subscription and re-sync owned org plans

Full Razorpay dashboard setup: [razorpay-webhook-setup.md](razorpay-webhook-setup.md)
