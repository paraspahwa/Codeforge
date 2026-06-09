from __future__ import annotations

from app.model_router import choose_model


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
