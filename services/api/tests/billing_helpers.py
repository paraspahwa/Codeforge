from __future__ import annotations

from app.db import insert_billing_order
from app.models import utc_now


def seed_billing_order(
    *,
    order_id: str,
    user_id: str,
    plan_id: str,
    amount_inr: int,
    org_id: str | None = None,
    status: str = "created",
) -> None:
    insert_billing_order(
        order_id=order_id,
        user_id=user_id,
        plan_id=plan_id,
        amount_inr=amount_inr,
        currency="INR",
        provider="mock",
        status=status,
        created_at=utc_now().isoformat(),
        org_id=org_id,
    )
