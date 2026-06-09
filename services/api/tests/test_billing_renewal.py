from __future__ import annotations

import json

from app.db import init_db

from .billing_helpers import seed_billing_order


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_subscription_charged_renews_subscription_and_syncs_org(client) -> None:
    init_db()
    headers = _auth_headers(client, "renewal-owner")
    org = client.post(
        "/api/v1/orgs",
        headers=headers,
        json={"name": "Renewal Org", "plan_id": "lite"},
    )
    org_id = org.json()["org_id"]
    seed_billing_order(
        order_id="order_renewal_team",
        user_id="renewal-owner",
        plan_id="team",
        amount_inr=1299,
        org_id=org_id,
    )

    client.post(
        "/api/v1/billing/verify-payment",
        headers=headers,
        json={
            "order_id": "order_renewal_team",
            "payment_id": "pay_renewal_team",
            "signature": "sig_renewal_team",
            "plan_id": "team",
            "amount_inr": 1299,
            "org_id": org_id,
        },
    )

    client.post(
        "/api/v1/billing/webhook",
        data=json.dumps(
            {
                "event": "subscription.cancelled",
                "payload": {"subscription": {"entity": {"id": "sub_lapse", "notes": {"user_id": "renewal-owner"}}}},
            }
        ),
        headers={"Content-Type": "application/json"},
    )

    lapse_context = client.get("/api/v1/billing/context", headers=headers)
    assert lapse_context.json()["subscription_plan_id"] == "free"
    assert lapse_context.json()["organization_plan_id"] == "lite"

    renewal = client.post(
        "/api/v1/billing/webhook",
        data=json.dumps(
            {
                "event": "subscription.charged",
                "payload": {
                    "subscription": {
                        "entity": {
                            "id": "sub_renew_1",
                            "notes": {"user_id": "renewal-owner", "plan_id": "team"},
                        }
                    }
                },
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert renewal.status_code == 200
    body = renewal.json()
    assert body["status"] == "renewed"
    assert org_id in body["synced_org_ids"]

    context = client.get("/api/v1/billing/context", headers=headers)
    assert context.json()["subscription_plan_id"] == "team"
    assert context.json()["organization_plan_id"] == "team"
    assert context.json()["effective_plan_id"] == "team"
