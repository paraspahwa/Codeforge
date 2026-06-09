from __future__ import annotations

import json

from app.db import get_user_subscription, init_db, upsert_user_subscription
from app.models import utc_now

from .billing_helpers import seed_billing_order


def test_subscription_renewal_resolves_user_by_stored_subscription_id(client) -> None:
    init_db()
    seed_billing_order(
        order_id="order_sub_lookup",
        user_id="sub-lookup-owner",
        plan_id="team",
        amount_inr=1299,
        status="paid",
    )
    upsert_user_subscription(
        user_id="sub-lookup-owner",
        plan_id="free",
        status="inactive",
        amount_inr=None,
        order_id="order_sub_lookup",
        updated_at=utc_now().isoformat(),
        razorpay_subscription_id="sub_lookup_abc",
    )

    event = {
        "event": "subscription.resumed",
        "payload": {
            "subscription": {
                "entity": {
                    "id": "sub_lookup_abc",
                    "notes": {"plan_id": "team"},
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
    assert body["status"] == "renewed"

    stored = get_user_subscription("sub-lookup-owner")
    assert stored is not None
    assert stored["plan_id"] == "team"
    assert stored["status"] == "active"
    assert stored["razorpay_subscription_id"] == "sub_lookup_abc"


def test_subscription_webhook_idempotency_uses_stable_event_id(client) -> None:
    init_db()
    upsert_user_subscription(
        user_id="sub-idem-owner",
        plan_id="team",
        status="active",
        amount_inr=1299,
        order_id="order_sub_idem",
        updated_at=utc_now().isoformat(),
        razorpay_subscription_id="sub_idem_1",
    )

    event = {
        "event": "subscription.charged",
        "payload": {
            "subscription": {
                "entity": {
                    "id": "sub_idem_1",
                    "notes": {"user_id": "sub-idem-owner", "plan_id": "team"},
                }
            }
        },
    }

    first = client.post(
        "/api/v1/billing/webhook",
        data=json.dumps(event),
        headers={"Content-Type": "application/json"},
    )
    second = client.post(
        "/api/v1/billing/webhook",
        data=json.dumps(event),
        headers={"Content-Type": "application/json"},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "duplicate"
