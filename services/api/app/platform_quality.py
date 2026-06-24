from __future__ import annotations

from typing import Any

from .db import get_routing_benchmark_baseline, latest_routing_benchmark_run
from .evals.swe_fixtures.tasks import SWE_FIXTURE_TASKS


def collect_public_quality_summary(suite: str = "swe-fixtures") -> dict[str, Any]:
    normalized = (suite or "swe-fixtures").strip().lower()
    if normalized != "swe-fixtures":
        normalized = "swe-fixtures"

    baseline = get_routing_benchmark_baseline(normalized)
    latest = latest_routing_benchmark_run(normalized)
    total_cases = len(SWE_FIXTURE_TASKS)

    baseline_pass_rate = float(baseline["pass_rate"]) if baseline else 1.0
    latest_pass_rate = float(latest["pass_rate"]) if latest else baseline_pass_rate
    passed_cases = int(round(latest_pass_rate * total_cases))

    return {
        "suite": normalized,
        "label": "SWE-bench-style fixture suite",
        "description": (
            "Synthetic bug-fix tasks: apply a patch to broken Python files and verify with pytest. "
            "Not the full SWE-bench Verified leaderboard — a fast regression harness we run in CI."
        ),
        "total_cases": total_cases,
        "passed_cases": passed_cases,
        "baseline_pass_rate": baseline_pass_rate,
        "latest_pass_rate": latest_pass_rate,
        "baseline_pass_rate_pct": round(baseline_pass_rate * 100, 1),
        "latest_pass_rate_pct": round(latest_pass_rate * 100, 1),
        "latest_run_at": latest.get("created_at") if latest else None,
        "regression_alert": bool(latest.get("regression_alert")) if latest else False,
        "regression_reason": latest.get("regression_reason") if latest else None,
        "has_baseline": baseline is not None,
        "has_latest_run": latest is not None,
    }
