from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


@dataclass
class RoutedModel:
    provider: str
    model: str
    reason: str


def model_for_tier(routing_tier: str) -> RoutedModel:
    tier = (routing_tier or "deepseek_flash").strip().lower()
    if tier == "fallback_opus":
        return RoutedModel(
            "anthropic",
            os.getenv("CODEFORGE_FRONTIER_MODEL", "claude-opus-4.1"),
            "frontier_fallback",
        )
    if tier == "fallback_sonnet":
        return RoutedModel(
            "anthropic",
            os.getenv("CODEFORGE_FALLBACK_MODEL", "claude-sonnet-4.6"),
            "hard_debug",
        )
    if tier == "deepseek_pro":
        return RoutedModel(
            "deepseek",
            os.getenv("CODEFORGE_COMPLEX_MODEL", "deepseek-v4-pro"),
            "complex_request",
        )
    if tier in {"cached_pattern"}:
        return RoutedModel("local", "context-cache", "cached_pattern")
    if tier in {"local_rule"}:
        return RoutedModel("local", "rule-engine", "local_rule")
    return RoutedModel(
        "deepseek",
        os.getenv("CODEFORGE_DEFAULT_MODEL", "deepseek-v4-flash"),
        "default_route",
    )


def choose_model(prompt: str) -> RoutedModel:
    text = (prompt or "").lower()

    frontier_keywords = [
        "frontier",
        "novel algorithm",
        "formal proof",
        "enterprise sev0",
        "critical architecture failure",
    ]
    if any(keyword in text for keyword in frontier_keywords):
        return model_for_tier("fallback_opus")

    if any(keyword in text for keyword in ["debug", "race condition", "incident", "crash"]):
        return model_for_tier("fallback_sonnet")

    if any(keyword in text for keyword in ["architecture", "refactor", "multi-file", "optimize", "performance", "design", "system"]):
        return model_for_tier("deepseek_pro")

    if any(keyword in text for keyword in ["pytest", "npm test", "cargo test", "run tests", "run test"]):
        return model_for_tier("local_rule")

    return model_for_tier("deepseek_flash")


class GenerationClient:
    """LiteLLM-first generation client with deterministic fallback."""

    def __init__(self) -> None:
        self._litellm = None
        self._backend = "deterministic"
        try:
            import litellm  # type: ignore

            self._litellm = litellm
            self._backend = "litellm"
        except Exception:
            self._litellm = None
            self._backend = "deterministic"

    @property
    def backend(self) -> str:
        return self._backend

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "You are CodeForge assistant.",
        *,
        max_tokens: int = 240,
        model: str | None = None,
    ) -> dict[str, Any]:
        route = choose_model(prompt)
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        synthesis_model = os.getenv("CODEFORGE_SYNTHESIS_MODEL", "gpt-4o-mini").strip()
        if openai_key:
            selected_model = f"openai/{synthesis_model}"
        else:
            selected_model = model or route.model

        if self._litellm is not None:
            try:
                response = await self._litellm.acompletion(
                    model=selected_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=max_tokens,
                )
                content = response.choices[0].message.content if response and response.choices else ""
                return {
                    "backend": "litellm",
                    "provider": route.provider,
                    "model": selected_model,
                    "reason": route.reason,
                    "text": content or "",
                }
            except Exception:
                pass

        # Deterministic fallback keeps APIs responsive without external model credentials.
        user_snippet = (prompt or "").strip()[:120]
        return {
            "backend": "deterministic",
            "provider": route.provider,
            "model": selected_model,
            "reason": route.reason,
            "text": (
                f"I can help with that. To get a full AI-generated answer, set OPENAI_API_KEY on the API service. "
                f"Request: {user_snippet}"
            ),
        }
