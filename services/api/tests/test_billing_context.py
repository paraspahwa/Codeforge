from __future__ import annotations

from app.db import init_db

from .billing_helpers import seed_billing_order


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_billing_context_uses_org_plan_when_higher(client) -> None:
    init_db()
    owner_headers = _auth_headers(client, "billing-owner")

    org = client.post(
        "/api/v1/orgs",
        headers=owner_headers,
        json={"name": "Billing Org", "plan_id": "team"},
    )
    assert org.status_code == 200
    org_id = org.json()["org_id"]

    member_headers = _auth_headers(client, "billing-member")
    client.post(
        f"/api/v1/orgs/{org_id}/members",
        headers=owner_headers,
        json={"user_id": "billing-member", "role": "member"},
    )

    context = client.get("/api/v1/billing/context", headers=member_headers)
    assert context.status_code == 200
    body = context.json()
    assert body["effective_plan_id"] == "team"
    assert body["effective_source"] == "organization"
    assert body["organization_plan_id"] == "team"
    assert any(item["org_id"] == org_id for item in body["organizations"])


def test_billing_context_prefers_subscription_over_lower_org_plan(client) -> None:
    init_db()
    owner_headers = _auth_headers(client, "billing-sub-owner")

    org = client.post(
        "/api/v1/orgs",
        headers=owner_headers,
        json={"name": "Lite Org", "plan_id": "lite"},
    )
    org_id = org.json()["org_id"]

    client.post(
        f"/api/v1/orgs/{org_id}/members",
        headers=owner_headers,
        json={"user_id": "billing-sub-owner", "role": "owner"},
    )

    seed_billing_order(
        order_id="order_test_pro",
        user_id="billing-sub-owner",
        plan_id="pro",
        amount_inr=499,
    )
    verify = client.post(
        "/api/v1/billing/verify-payment",
        headers=owner_headers,
        json={
            "order_id": "order_test_pro",
            "payment_id": "pay_test_pro",
            "signature": "sig_test",
            "plan_id": "pro",
            "amount_inr": 499,
        },
    )
    assert verify.status_code == 200

    context = client.get("/api/v1/billing/context", headers=owner_headers)
    assert context.status_code == 200
    body = context.json()
    assert body["effective_plan_id"] == "pro"
    assert body["effective_source"] == "subscription"
    assert body["subscription_plan_id"] == "pro"
