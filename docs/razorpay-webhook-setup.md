# Razorpay Webhook and SSM Setup

This runbook wires Razorpay billing for ECS deployments. Payment verification and subscription sync depend on API keys in SSM and a dashboard webhook pointed at your public API host.

## 1. SSM parameters

ECS API task definitions read:

| Parameter | SSM path (staging) | SSM path (production) |
|-----------|-------------------|----------------------|
| `RAZORPAY_KEY_ID` | `/codeforge/staging/RAZORPAY_KEY_ID` | `/codeforge/prod/RAZORPAY_KEY_ID` |
| `RAZORPAY_KEY_SECRET` | `/codeforge/staging/RAZORPAY_KEY_SECRET` | `/codeforge/prod/RAZORPAY_KEY_SECRET` |

Bootstrap from a local env file:

```bash
cp .env.razorpay.example .env.razorpay
# edit keys (use test keys for staging)

python scripts/bootstrap_razorpay_ssm.py \
  --environment staging \
  --env-file .env.razorpay \
  --api-public-url https://api-staging.yourdomain.com
```

Print dashboard checklist only:

```bash
python scripts/bootstrap_razorpay_ssm.py --print-checklist --api-public-url https://api-staging.yourdomain.com
```

## 2. Razorpay dashboard webhook

Register in Razorpay → Settings → Webhooks:

| Field | Value |
|-------|-------|
| URL | `https://<api-host>/api/v1/billing/webhook` |
| Secret | Same value as `RAZORPAY_KEY_SECRET` (used for `X-Razorpay-Signature` HMAC) |

### Events to enable

**Payments**

- `payment.captured`
- `payment.authorized`
- `payment.failed`
- `order.paid`

**Subscription lapse**

- `subscription.cancelled`
- `subscription.halted`
- `subscription.completed`
- `subscription.paused`

**Subscription renewal**

- `subscription.charged`
- `subscription.activated`
- `subscription.resumed`
- `subscription.updated`

## 3. Deploy readiness

After deploy, verify billing configuration:

```bash
curl -fsS "https://api-staging.yourdomain.com/api/v1/platform/deploy-readiness?probe_billing=true"
```

Production (`CODEFORGE_ENV=production`) requires `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. The response includes `billing_webhook_url` when `CODEFORGE_PUBLIC_API_BASE` or an API hostname is configured.

## 4. CI and post-deploy checks

- Pre-deploy smoke exercises billing webhook HMAC when `RAZORPAY_KEY_SECRET` is set in compose.
- `scripts/post_deploy_public_smoke.sh` runs after ECS deploy when `WEB_PUBLIC_URL_*` and `NEXT_PUBLIC_API_BASE_*` GitHub variables are configured.

## 5. Staging vs production keys

- **Staging**: Razorpay test mode keys (`rzp_test_*`)
- **Production**: Live keys only after staging webhook flow is validated

Pair with [production-domains.md](production-domains.md) for public API/web URL wiring.
