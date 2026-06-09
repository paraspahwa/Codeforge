from __future__ import annotations

import json

from app.db import get_billing_order, init_db

from .billing_helpers import seed_billing_order


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_subscription_cancel_webhook_downgrades_owned_orgs(client) -> None:
    init_db()
    headers = _auth_headers(client, "lapse-owner")
    org = client.post(
        "/api/v1/orgs",
        headers=headers,
        json={"name": "Lapse Org", "plan_id": "lite"},
    )
    org_id = org.json()["org_id"]
    seed_billing_order(
        order_id="order_lapse_team",
        user_id="lapse-owner",
        plan_id="team",
        amount_inr=1299,
        org_id=org_id,
    )

    verify = client.post(
        "/api/v1/billing/verify-payment",
        headers=headers,
        json={
            "order_id": "order_lapse_team",
            "payment_id": "pay_lapse_team",
            "signature": "sig_lapse_team",
            "plan_id": "team",
            "amount_inr": 1299,
            "org_id": org_id,
        },
    )
    assert verify.status_code == 200

    event = {
        "event": "subscription.cancelled",
        "payload": {
            "subscription": {
                "entity": {
                    "id": "sub_lapse_1",
                    "notes": {"user_id": "lapse-owner"},
                }
            }
        },
    }
    response = client.post(
        "/api/v1/billing/webhook",
        data=json.dumps(event),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "lapsed"
    assert org_id in body["downgraded_org_ids"]

    context = client.get("/api/v1/billing/context", headers=headers)
    assert context.json()["subscription_plan_id"] == "free"
    assert context.json()["organization_plan_id"] == "lite"


def test_payment_failed_marks_order_failed(client) -> None:
    init_db()
    headers = _auth_headers(client, "failed-pay-user")
    created = client.post(
        "/api/v1/billing/create-order",
        headers=headers,
        json={"plan_id": "pro", "amount_inr": 499, "currency": "INR"},
    )
    order_id = created.json()["order_id"]

    event = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_failed_1",
                    "order_id": order_id,
                    "notes": {"user_id": "failed-pay-user"},
                }
            }
        },
    }
    response = client.post(
        "/api/v1/billing/webhook",
        data=json.dumps(event),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "processed"

    order = get_billing_order(order_id)
    assert order is not None
    assert order["status"] == "failed"
