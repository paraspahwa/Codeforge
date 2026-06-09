from __future__ import annotations

import hashlib
import json
from typing import Any

from .db import (
    get_billing_order,
    get_latest_paid_order_for_user,
    get_user_subscription,
    get_user_subscription_by_razorpay_id,
    update_billing_order_status,
    upsert_user_subscription,
)
from .models import utc_now
from .org_service import OrgError, org_service


class BillingError(RuntimeError):
    def __init__(self, detail: str, status_code: int = 400) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code

PAYMENT_SUCCESS_EVENTS = {"payment.captured", "payment.authorized", "order.paid"}
SUBSCRIPTION_LAPSE_EVENTS = {
    "subscription.cancelled",
    "subscription.halted",
    "subscription.completed",
    "subscription.paused",
}
SUBSCRIPTION_RENEWAL_EVENTS = {
    "subscription.charged",
    "subscription.activated",
    "subscription.resumed",
    "subscription.updated",
}


def derive_webhook_event_id(event: dict[str, Any]) -> str:
    top_level_id = event.get("id")
    if top_level_id:
        return f"evt_{top_level_id}"

    event_type = str(event.get("event", "unknown"))
    payload = event.get("payload") or {}
    for key in ("payment", "subscription", "order"):
        entity = ((payload.get(key) or {}).get("entity")) or {}
        entity_id = entity.get("id")
        if entity_id:
            return f"evt_{event_type}:{entity_id}"

    digest = hashlib.sha256(json.dumps(event, sort_keys=True).encode("utf-8")).hexdigest()[:32]
    return f"evt_{event_type}:{digest}"


def apply_verified_payment(
    *,
    user_id: str,
    order_id: str,
    plan_id: str,
    amount_inr: int,
    org_id: str | None = None,
    payment_id: str | None = None,
    razorpay_subscription_id: str | None = None,
) -> dict[str, Any]:
    _ = payment_id
    order = get_billing_order(order_id)
    if order is None:
        raise BillingError("Order not found", 404)
    if str(order.get("user_id") or "") != user_id:
        raise BillingError("Order does not belong to user", 403)
    if str(order.get("plan_id") or "") != plan_id:
        raise BillingError("plan_id does not match order", 400)
    if int(order.get("amount_inr") or 0) != int(amount_inr):
        raise BillingError("amount_inr does not match order", 400)

    order_org_id = order.get("org_id")
    if org_id and order_org_id and str(org_id) != str(order_org_id):
        raise BillingError("org_id does not match order", 400)

    if order.get("status") == "paid":
        subscription = get_user_subscription(user_id)
        return {
            "status": "verified",
            "subscription_plan": subscription["plan_id"] if subscription else plan_id,
            "order_id": order_id,
            "org_id": str(order_org_id) if order_org_id else None,
            "organization_plan_id": None,
            "org_plan_updated": False,
            "duplicate": True,
        }

    update_billing_order_status(order_id, "paid")
    upsert_user_subscription(
        user_id=user_id,
        plan_id=plan_id,
        status="active",
        amount_inr=amount_inr,
        order_id=order_id,
        updated_at=utc_now().isoformat(),
        razorpay_subscription_id=razorpay_subscription_id,
    )

    org_plan_updated = False
    organization_plan_id = None
    upgraded_org_id = None
    target_org_id = org_id or order_org_id

    if target_org_id:
        try:
            org = org_service.upgrade_organization_plan(
                actor_id=user_id,
                org_id=target_org_id,
                plan_id=plan_id,
                require_active_subscription=False,
            )
            org_plan_updated = True
            organization_plan_id = org["plan_id"]
            upgraded_org_id = org["org_id"]
        except OrgError:
            org_plan_updated = False

    return {
        "status": "verified",
        "subscription_plan": plan_id,
        "order_id": order_id,
        "org_id": upgraded_org_id,
        "organization_plan_id": organization_plan_id,
        "org_plan_updated": org_plan_updated,
    }


def apply_subscription_lapse(
    *,
    user_id: str,
    razorpay_subscription_id: str | None = None,
) -> dict[str, Any]:
    existing = get_user_subscription(user_id)
    previous_plan = existing["plan_id"] if existing else "free"
    upsert_user_subscription(
        user_id=user_id,
        plan_id="free",
        status="inactive",
        amount_inr=None,
        order_id=existing.get("order_id") if existing else None,
        updated_at=utc_now().isoformat(),
        razorpay_subscription_id=razorpay_subscription_id
        or (existing.get("razorpay_subscription_id") if existing else None),
    )
    downgraded_org_ids = org_service.sync_owned_orgs_after_subscription_lapse(owner_id=user_id, plan_id="lite")
    return {
        "status": "lapsed",
        "user_id": user_id,
        "previous_plan_id": previous_plan,
        "downgraded_org_ids": downgraded_org_ids,
        "org_plan_updated": bool(downgraded_org_ids),
        "organization_plan_id": "lite" if downgraded_org_ids else None,
    }


def apply_subscription_renewal(
    *,
    user_id: str,
    plan_id: str | None = None,
    razorpay_subscription_id: str | None = None,
) -> dict[str, Any]:
    existing = get_user_subscription(user_id)
    latest_order = get_latest_paid_order_for_user(user_id)
    target_plan = plan_id or (existing["plan_id"] if existing else None) or (latest_order["plan_id"] if latest_order else None)
    if not target_plan or target_plan == "free":
        return {"status": "ignored", "user_id": user_id, "detail": "no paid plan to renew"}

    amount_inr = existing.get("amount_inr") if existing else None
    if amount_inr is None and latest_order:
        amount_inr = latest_order.get("amount_inr")
    order_id = existing.get("order_id") if existing else None
    if order_id is None and latest_order:
        order_id = latest_order.get("order_id")

    upsert_user_subscription(
        user_id=user_id,
        plan_id=target_plan,
        status="active",
        amount_inr=amount_inr,
        order_id=order_id,
        updated_at=utc_now().isoformat(),
        razorpay_subscription_id=razorpay_subscription_id
        or (existing.get("razorpay_subscription_id") if existing else None),
    )

    synced_org_ids: list[str] = []
    organization_plan_id = None
    org_plan_updated = False
    preferred_org_id = latest_order.get("org_id") if latest_order else None
    if preferred_org_id:
        try:
            org = org_service.upgrade_organization_plan(
                actor_id=user_id,
                org_id=str(preferred_org_id),
                plan_id=target_plan,
                require_active_subscription=False,
            )
            synced_org_ids.append(org["org_id"])
            organization_plan_id = org["plan_id"]
            org_plan_updated = True
        except OrgError:
            pass

    remaining = org_service.sync_owned_orgs_to_plan(owner_id=user_id, plan_id=target_plan)
    for org_id in remaining:
        if org_id not in synced_org_ids:
            synced_org_ids.append(org_id)
    if synced_org_ids and not organization_plan_id:
        organization_plan_id = target_plan
        org_plan_updated = True

    return {
        "status": "renewed",
        "user_id": user_id,
        "subscription_plan": target_plan,
        "synced_org_ids": synced_org_ids,
        "org_plan_updated": org_plan_updated,
        "organization_plan_id": organization_plan_id,
    }


def _extract_plan_id_from_event(event: dict[str, Any]) -> str | None:
    payload = event.get("payload") or {}
    for key in ("subscription", "payment", "order"):
        entity = ((payload.get(key) or {}).get("entity")) or {}
        notes = entity.get("notes") or {}
        plan_id = notes.get("plan_id")
        if plan_id:
            return str(plan_id)
    return None


def _extract_subscription_id_from_event(event: dict[str, Any]) -> str | None:
    payload = event.get("payload") or {}
    entity = ((payload.get("subscription") or {}).get("entity")) or {}
    subscription_id = entity.get("id")
    return str(subscription_id) if subscription_id else None


def _extract_user_id_from_event(event: dict[str, Any]) -> str | None:
    payload = event.get("payload") or {}
    for key in ("subscription", "payment", "order"):
        entity = ((payload.get(key) or {}).get("entity")) or {}
        notes = entity.get("notes") or {}
        user_id = notes.get("user_id")
        if user_id:
            return str(user_id)
    return None


def _resolve_user_id_for_subscription_event(event: dict[str, Any]) -> str | None:
    user_id = _extract_user_id_from_event(event)
    if user_id:
        return user_id

    subscription_id = _extract_subscription_id_from_event(event)
    if subscription_id:
        stored = get_user_subscription_by_razorpay_id(subscription_id)
        if stored:
            return str(stored["user_id"])

    payload = event.get("payload") or {}
    payment_entity = ((payload.get("payment") or {}).get("entity")) or {}
    order_id = str(payment_entity.get("order_id") or "").strip()
    if order_id:
        order = get_billing_order(order_id)
        if order:
            return str(order.get("user_id") or "") or None
    return None


def _process_payment_success_event(event: dict[str, Any], event_type: str) -> dict[str, Any]:
    payload = event.get("payload") or {}
    payment_entity = ((payload.get("payment") or {}).get("entity")) or {}
    order_entity = ((payload.get("order") or {}).get("entity")) or {}

    order_id = str(payment_entity.get("order_id") or order_entity.get("id") or "").strip()
    if not order_id:
        return {"status": "ignored", "event_type": event_type, "detail": "missing order_id"}

    order = get_billing_order(order_id)
    if order is None:
        return {"status": "ignored", "event_type": event_type, "order_id": order_id, "detail": "order not found"}

    if order.get("status") == "paid":
        return {"status": "duplicate", "order_id": order_id, "event_type": event_type}

    notes = order_entity.get("notes") or {}
    plan_id = str(notes.get("plan_id") or order.get("plan_id") or "").strip()
    user_id = str(notes.get("user_id") or order.get("user_id") or "").strip()
    org_id = notes.get("org_id") or order.get("org_id")
    amount_inr = int(notes.get("amount_inr") or order.get("amount_inr") or 0)
    payment_id = str(payment_entity.get("id") or "").strip() or None

    if not plan_id or not user_id or amount_inr <= 0:
        return {
            "status": "ignored",
            "event_type": event_type,
            "order_id": order_id,
            "detail": "missing plan/user/amount",
        }

    result = apply_verified_payment(
        user_id=user_id,
        order_id=order_id,
        plan_id=plan_id,
        amount_inr=amount_inr,
        org_id=str(org_id) if org_id else None,
        payment_id=payment_id,
    )
    result["status"] = "processed"
    result["event_type"] = event_type
    return result


def _process_payment_failed_event(event: dict[str, Any], event_type: str) -> dict[str, Any]:
    payload = event.get("payload") or {}
    payment_entity = ((payload.get("payment") or {}).get("entity")) or {}
    order_id = str(payment_entity.get("order_id") or "").strip()
    if order_id:
        order = get_billing_order(order_id)
        if order and order.get("status") != "paid":
            update_billing_order_status(order_id, "failed")
            return {"status": "processed", "event_type": event_type, "order_id": order_id}
    return {"status": "ignored", "event_type": event_type, "detail": "no actionable failed payment"}


def _process_subscription_lapse_event(event: dict[str, Any], event_type: str) -> dict[str, Any]:
    user_id = _resolve_user_id_for_subscription_event(event)
    if not user_id:
        return {"status": "ignored", "event_type": event_type, "detail": "missing user_id"}

    subscription = get_user_subscription(user_id)
    if subscription and subscription.get("status") == "inactive" and subscription.get("plan_id") == "free":
        return {"status": "duplicate", "event_type": event_type, "user_id": user_id}

    result = apply_subscription_lapse(
        user_id=user_id,
        razorpay_subscription_id=_extract_subscription_id_from_event(event),
    )
    result["event_type"] = event_type
    return result


def _process_subscription_renewal_event(event: dict[str, Any], event_type: str) -> dict[str, Any]:
    user_id = _resolve_user_id_for_subscription_event(event)
    if not user_id:
        return {"status": "ignored", "event_type": event_type, "detail": "missing user_id"}

    plan_id = _extract_plan_id_from_event(event)
    result = apply_subscription_renewal(
        user_id=user_id,
        plan_id=plan_id,
        razorpay_subscription_id=_extract_subscription_id_from_event(event),
    )
    result["event_type"] = event_type
    return result


def process_razorpay_webhook_event(event: dict[str, Any]) -> dict[str, Any]:
    event_type = str(event.get("event", "unknown"))
    if event_type in PAYMENT_SUCCESS_EVENTS:
        return _process_payment_success_event(event, event_type)
    if event_type == "payment.failed":
        return _process_payment_failed_event(event, event_type)
    if event_type in SUBSCRIPTION_LAPSE_EVENTS:
        return _process_subscription_lapse_event(event, event_type)
    if event_type in SUBSCRIPTION_RENEWAL_EVENTS:
        return _process_subscription_renewal_event(event, event_type)
    return {"status": "ignored", "event_type": event_type}
