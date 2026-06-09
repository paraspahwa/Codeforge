from __future__ import annotations

import json

from app.db import get_billing_order, init_db, insert_billing_order


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_org(client, headers: dict[str, str]) -> str:
    created = client.post(
        "/api/v1/orgs",
        headers=headers,
        json={"name": "Webhook Org", "plan_id": "lite"},
    )
    assert created.status_code == 200
    return created.json()["org_id"]


def test_billing_webhook_processes_payment_and_upgrades_org(client) -> None:
    init_db()
    headers = _auth_headers(client, "webhook-owner")
    org_id = _create_org(client, headers)

    order = client.post(
        "/api/v1/billing/create-order",
        headers=headers,
        json={"plan_id": "team", "amount_inr": 1299, "currency": "INR", "org_id": org_id},
    )
    assert order.status_code == 200
    order_id = order.json()["order_id"]

    stored = get_billing_order(order_id)
    assert stored is not None
    assert stored["org_id"] == org_id

    event = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_webhook_1",
                    "order_id": order_id,
                }
            },
            "order": {
                "entity": {
                    "id": order_id,
                    "notes": {
                        "plan_id": "team",
                        "user_id": "webhook-owner",
                        "amount_inr": "1299",
                        "org_id": org_id,
                    },
                }
            },
        },
    }

    response = client.post(
        "/api/v1/billing/webhook",
        data=json.dumps(event),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "processed"
    assert body["org_plan_updated"] is True
    assert body["organization_plan_id"] == "team"

    paid = get_billing_order(order_id)
    assert paid is not None
    assert paid["status"] == "paid"

    context = client.get("/api/v1/billing/context", headers=headers)
    assert context.json()["organization_plan_id"] == "team"


def test_billing_webhook_is_idempotent_for_paid_orders(client) -> None:
    init_db()
    headers = _auth_headers(client, "webhook-dup")
    insert_billing_order(
        order_id="order_dup_1",
        user_id="webhook-dup",
        plan_id="pro",
        amount_inr=499,
        currency="INR",
        provider="mock",
        status="paid",
        created_at="2026-06-01T00:00:00+00:00",
        org_id=None,
    )

    event = {
        "event": "payment.captured",
        "payload": {
            "payment": {"entity": {"id": "pay_dup_1", "order_id": "order_dup_1"}},
            "order": {
                "entity": {
                    "id": "order_dup_1",
                    "notes": {"plan_id": "pro", "user_id": "webhook-dup", "amount_inr": "499"},
                }
            },
        },
    }

    response = client.post(
        "/api/v1/billing/webhook",
        data=json.dumps(event),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "duplicate"
