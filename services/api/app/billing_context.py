from __future__ import annotations

from typing import Any, Literal

from .db import get_user_subscription
from .models import utc_now
from .org_store import best_plan_for_user, list_organizations_for_user
from .usage_policy import get_usage_policy

PLAN_PRIORITY = {"team": 3, "pro": 2, "lite": 1, "free": 0}


def _user_org_role(org: dict[str, Any], user_id: str) -> str:
    if org.get("owner_id") == user_id:
        return "owner"
    for member in org.get("members", []):
        if member.get("user_id") == user_id:
            return str(member.get("role", "member"))
    return "member"


def _resolve_effective_source(
    *,
    subscription_plan: str,
    organization_plan: str | None,
    effective_plan_id: str,
) -> Literal["organization", "subscription", "free"]:
    if effective_plan_id == "free":
        return "free"

    org_score = PLAN_PRIORITY.get(organization_plan or "free", 0)
    sub_score = PLAN_PRIORITY.get(subscription_plan, 0)

    if organization_plan and org_score >= sub_score and effective_plan_id == organization_plan:
        return "organization"
    if subscription_plan not in {"", "free"} and sub_score >= org_score and effective_plan_id == subscription_plan:
        return "subscription"
    if organization_plan and effective_plan_id == organization_plan:
        return "organization"
    if subscription_plan not in {"", "free"}:
        return "subscription"
    return "free"


def build_billing_context(user_id: str) -> dict[str, Any]:
    organizations = list_organizations_for_user(user_id)
    subscription = get_user_subscription(user_id)
    subscription_plan = subscription["plan_id"] if subscription else "free"
    organization_plan = best_plan_for_user(user_id)

    effective_plan_id, request_limit, requests_used, requests_remaining, period_start = get_usage_policy(user_id)
    effective_source = _resolve_effective_source(
        subscription_plan=subscription_plan,
        organization_plan=organization_plan,
        effective_plan_id=effective_plan_id,
    )

    org_items = [
        {
            "org_id": org["org_id"],
            "name": org["name"],
            "plan_id": org["plan_id"],
            "role": _user_org_role(org, user_id),
        }
        for org in organizations
    ]

    return {
        "user_id": user_id,
        "effective_plan_id": effective_plan_id,
        "effective_source": effective_source,
        "subscription_plan_id": subscription_plan,
        "organization_plan_id": organization_plan,
        "subscription_status": subscription["status"] if subscription else "inactive",
        "request_limit": request_limit,
        "requests_used_in_period": requests_used,
        "requests_remaining": requests_remaining,
        "billing_period_start": period_start,
        "organizations": org_items,
        "generated_at": utc_now().isoformat(),
    }
