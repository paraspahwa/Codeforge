from __future__ import annotations

from app.model_router import choose_model, model_for_tier


def test_choose_model_defaults_to_flash() -> None:
    route = choose_model("add a helper function")
    assert route.model
    assert route.provider == "deepseek"


def test_choose_model_routes_debug_prompts() -> None:
    route = choose_model("debug this production crash")
    assert route.reason == "hard_debug"


def test_choose_model_routes_complex_prompts() -> None:
    route = choose_model("refactor the architecture for scale")
    assert route.reason == "complex_request"


def test_choose_model_routes_frontier_prompts_to_opus() -> None:
    route = choose_model("frontier formal proof for novel algorithm")
    assert route.reason == "frontier_fallback"
    assert "opus" in route.model.lower()


def test_model_for_tier_maps_policy_paths() -> None:
    flash = model_for_tier("deepseek_flash")
    sonnet = model_for_tier("fallback_sonnet")
    opus = model_for_tier("fallback_opus")
    assert flash.provider == "deepseek"
    assert sonnet.provider == "anthropic"
    assert opus.provider == "anthropic"
