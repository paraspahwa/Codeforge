from __future__ import annotations

from app.db import init_db

from .billing_helpers import seed_billing_order


def _auth_headers(client, user_id: str) -> dict[str, str]:
    login = client.post("/api/v1/auth/dev-login", json={"user_id": user_id})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_verify_payment_rejects_unknown_order(client) -> None:
    init_db()
    headers = _auth_headers(client, "verify-unknown")

    response = client.post(
        "/api/v1/billing/verify-payment",
        headers=headers,
        json={
            "order_id": "order_missing",
            "payment_id": "pay_missing",
            "signature": "sig_missing",
            "plan_id": "pro",
            "amount_inr": 499,
        },
    )
    assert response.status_code == 404


def test_verify_payment_rejects_plan_mismatch(client) -> None:
    init_db()
    headers = _auth_headers(client, "verify-mismatch")
    seed_billing_order(
        order_id="order_mismatch",
        user_id="verify-mismatch",
        plan_id="team",
        amount_inr=1299,
    )

    response = client.post(
        "/api/v1/billing/verify-payment",
        headers=headers,
        json={
            "order_id": "order_mismatch",
            "payment_id": "pay_mismatch",
            "signature": "sig_mismatch",
            "plan_id": "pro",
            "amount_inr": 1299,
        },
    )
    assert response.status_code == 400
    assert "plan_id" in response.json()["detail"]


def test_verify_payment_is_idempotent_for_paid_order(client) -> None:
    init_db()
    headers = _auth_headers(client, "verify-paid")
    seed_billing_order(
        order_id="order_already_paid",
        user_id="verify-paid",
        plan_id="pro",
        amount_inr=499,
        status="paid",
    )

    response = client.post(
        "/api/v1/billing/verify-payment",
        headers=headers,
        json={
            "order_id": "order_already_paid",
            "payment_id": "pay_already_paid",
            "signature": "sig_already_paid",
            "plan_id": "pro",
            "amount_inr": 499,
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "verified"
