from __future__ import annotations

from datetime import datetime, timezone

from app.db import init_db, insert_usage_log
from app.usage_policy import billing_period_start_iso, get_usage_policy


def test_billing_period_starts_on_first_day_of_month() -> None:
    start = billing_period_start_iso(datetime(2026, 6, 15, tzinfo=timezone.utc))
    assert start.startswith("2026-06-01")


def test_get_usage_policy_counts_only_current_period() -> None:
    init_db()
    user_id = "usage-policy-user"
    insert_usage_log(
        usage_id="usage_old",
        user_id=user_id,
        session_id="sess_old",
        model_used="deepseek-v4-flash",
        input_tokens=1,
        output_tokens=1,
        cost_usd=0.001,
        latency_ms=10,
        created_at="2020-01-01T00:00:00+00:00",
    )
    insert_usage_log(
        usage_id="usage_new",
        user_id=user_id,
        session_id="sess_new",
        model_used="deepseek-v4-flash",
        input_tokens=1,
        output_tokens=1,
        cost_usd=0.001,
        latency_ms=10,
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    plan_id, request_limit, requests_used, requests_remaining, _period_start = get_usage_policy(user_id)
    assert plan_id == "free"
    assert request_limit == 100
    assert requests_used == 1
    assert requests_remaining == 99
