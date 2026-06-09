from __future__ import annotations

from app.db import init_db
from app.main import _evaluate_benchmark_regression
from app.quality_eval import run_quality_eval


def test_run_quality_eval_swe_fixtures_pass() -> None:
    result = run_quality_eval("swe-fixtures")
    assert result["total_cases"] >= 3
    assert result["pass_rate"] == 1.0
    assert all(item["passed"] for item in result["results"])
    assert all(item["patch_applied"] for item in result["results"])


def test_quality_benchmark_endpoint_persists_run(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "quality-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/evals/quality-benchmark?suite=swe-fixtures", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["pass_rate"] == 1.0
    assert body["regression_alert"] is False
    assert len(body["results"]) >= 3

    trends = client.get("/api/v1/evals/quality-benchmark/trends?suite=swe-fixtures&limit=5", headers=headers)
    assert trends.status_code == 200
    assert len(trends.json()["runs"]) >= 1


def test_quality_regression_detects_pass_rate_drop() -> None:
    result = {
        "pass_rate": 0.66,
        "fallback_usage_rate": 0.0,
        "low_confidence_rate": 0.0,
    }
    baseline = {
        "pass_rate": 1.0,
        "fallback_usage_rate": 0.0,
        "low_confidence_rate": 0.0,
    }
    alert, reason = _evaluate_benchmark_regression(result, baseline)
    assert alert is True
    assert "pass_rate dropped" in reason
