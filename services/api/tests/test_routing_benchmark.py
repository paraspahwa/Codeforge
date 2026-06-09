from __future__ import annotations

from app.agent import route_request, run_routing_benchmark
from app.db import init_db
from app.main import _evaluate_benchmark_regression


def test_run_routing_benchmark_policy_suite_passes() -> None:
    result = run_routing_benchmark("policy")
    assert result["total_cases"] >= 6
    assert result["pass_rate"] == 1.0
    assert result["fallback_usage_rate"] >= 0.0


def test_route_request_frontier_uses_opus_tier() -> None:
    decision = route_request("This is a frontier request requiring formal proof-level reasoning")
    assert decision.intent == "frontier_reasoning"
    assert decision.routing_tier == "fallback_opus"
    assert decision.fallback_used is True
    assert decision.review_required is True
    assert "opus" in decision.model_used.lower()


def test_route_request_hard_debug_uses_sonnet_tier() -> None:
    decision = route_request("We have a production incident and crash loop, help debug root cause")
    assert decision.intent == "hard_debug"
    assert decision.routing_tier == "fallback_sonnet"
    assert decision.fallback_used is True
    assert decision.review_required is True


def test_route_request_simple_edit_stays_on_deepseek_flash() -> None:
    decision = route_request("Please make a small docs update in README and keep it concise")
    assert decision.intent == "simple_edit"
    assert decision.routing_tier == "deepseek_flash"
    assert decision.fallback_used is False
    assert "flash" in decision.model_used.lower()


def test_low_confidence_forces_review() -> None:
    decision = route_request("maybe unsure about this possible quick guess for a small docs tweak")
    assert decision.review_required is True
    assert decision.confidence_label == "low"


def test_evaluate_benchmark_regression_detects_pass_rate_drop() -> None:
    result = {
        "pass_rate": 0.7,
        "fallback_usage_rate": 0.2,
        "low_confidence_rate": 0.1,
    }
    baseline = {
        "pass_rate": 1.0,
        "fallback_usage_rate": 0.1,
        "low_confidence_rate": 0.05,
    }
    alert, reason = _evaluate_benchmark_regression(result, baseline)
    assert alert is True
    assert "pass_rate dropped" in reason


def test_evaluate_benchmark_regression_no_alert_when_stable() -> None:
    result = {
        "pass_rate": 0.98,
        "fallback_usage_rate": 0.16,
        "low_confidence_rate": 0.08,
    }
    baseline = {
        "pass_rate": 1.0,
        "fallback_usage_rate": 0.16,
        "low_confidence_rate": 0.08,
    }
    alert, reason = _evaluate_benchmark_regression(result, baseline)
    assert alert is False
    assert reason == ""


def test_routing_benchmark_endpoint_persists_run(client) -> None:
    init_db()
    login = client.post("/api/v1/auth/dev-login", json={"user_id": "routing-user"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/evals/routing-benchmark?suite=policy", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["pass_rate"] == 1.0
    assert body["total_cases"] >= 6

    trends = client.get("/api/v1/evals/routing-benchmark/trends?suite=policy&limit=5", headers=headers)
    assert trends.status_code == 200
    assert len(trends.json()["runs"]) >= 1
