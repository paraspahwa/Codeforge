from __future__ import annotations

import os
from datetime import datetime, timezone

from .db import get_usage_count_for_user_since, get_user_subscription

FREE_REQUEST_LIMIT = int(os.getenv("CODEFORGE_FREE_REQUEST_LIMIT", "100"))

PLAN_LIMITS: dict[str, int] = {
    "lite": 300,
    "pro": 1000,
    "team": 2500,
}


def billing_period_start_iso(now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    start = current.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat()


def get_usage_policy(user_id: str) -> tuple[str, int, int, int, str]:
    """Return plan_id, request_limit, requests_used, requests_remaining, period_start."""
    subscription = get_user_subscription(user_id)
    plan_id = subscription["plan_id"] if subscription else "free"
    request_limit = PLAN_LIMITS.get(plan_id, FREE_REQUEST_LIMIT)
    period_start = billing_period_start_iso()
    requests_used = get_usage_count_for_user_since(user_id, period_start)
    requests_remaining = max(0, request_limit - requests_used)
    return plan_id, request_limit, requests_used, requests_remaining, period_start
