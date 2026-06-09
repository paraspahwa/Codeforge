from __future__ import annotations

from app.db import init_db

from .billing_helpers import seed_billing_order


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_org(client, headers: dict[str, str], name: str = "Upgrade Org") -> str:
    created = client.post(
        "/api/v1/orgs",
        headers=headers,
        json={"name": name, "plan_id": "lite"},
    )
    assert created.status_code == 200
    return created.json()["org_id"]


def test_verify_payment_upgrades_organization_plan(client) -> None:
    init_db()
    headers = _auth_headers(client, "org-upgrade-owner")
    org_id = _create_org(client, headers)
    seed_billing_order(
        order_id="order_team_upgrade",
        user_id="org-upgrade-owner",
        plan_id="team",
        amount_inr=1299,
        org_id=org_id,
    )

    verify = client.post(
        "/api/v1/billing/verify-payment",
        headers=headers,
        json={
            "order_id": "order_team_upgrade",
            "payment_id": "pay_team_upgrade",
            "signature": "sig_team_upgrade",
            "plan_id": "team",
            "amount_inr": 1299,
            "org_id": org_id,
        },
    )
    assert verify.status_code == 200
    body = verify.json()
    assert body["org_plan_updated"] is True
    assert body["organization_plan_id"] == "team"

    context = client.get("/api/v1/billing/context", headers=headers)
    assert context.json()["organization_plan_id"] == "team"


def test_manual_org_plan_upgrade_requires_active_subscription(client) -> None:
    init_db()
    headers = _auth_headers(client, "org-manual-owner")
    org_id = _create_org(client, headers)

    denied = client.post(
        f"/api/v1/orgs/{org_id}/plan",
        headers=headers,
        json={"plan_id": "pro"},
    )
    assert denied.status_code == 400

    seed_billing_order(
        order_id="order_pro_manual",
        user_id="org-manual-owner",
        plan_id="pro",
        amount_inr=499,
    )
    client.post(
        "/api/v1/billing/verify-payment",
        headers=headers,
        json={
            "order_id": "order_pro_manual",
            "payment_id": "pay_pro_manual",
            "signature": "sig_pro_manual",
            "plan_id": "pro",
            "amount_inr": 499,
        },
    )

    upgraded = client.post(
        f"/api/v1/orgs/{org_id}/plan",
        headers=headers,
        json={"plan_id": "pro"},
    )
    assert upgraded.status_code == 200
    assert upgraded.json()["plan_id"] == "pro"


def test_org_plan_upgrade_rejects_downgrade(client) -> None:
    init_db()
    headers = _auth_headers(client, "org-downgrade-owner")
    org_id = _create_org(client, headers, name="Team Org")
    seed_billing_order(
        order_id="order_team_downgrade",
        user_id="org-downgrade-owner",
        plan_id="team",
        amount_inr=1299,
        org_id=org_id,
    )

    client.post(
        "/api/v1/billing/verify-payment",
        headers=headers,
        json={
            "order_id": "order_team_downgrade",
            "payment_id": "pay_team_downgrade",
            "signature": "sig_team_downgrade",
            "plan_id": "team",
            "amount_inr": 1299,
            "org_id": org_id,
        },
    )

    denied = client.post(
        f"/api/v1/orgs/{org_id}/plan",
        headers=headers,
        json={"plan_id": "lite"},
    )
    assert denied.status_code == 400
