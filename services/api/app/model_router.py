from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


@dataclass
class RoutedModel:
    provider: str
    model: str
    reason: str


def choose_model(prompt: str) -> RoutedModel:
    text = (prompt or "").lower()
    if any(k in text for k in ["debug", "incident", "production", "crash"]):
        return RoutedModel("anthropic", os.getenv("CODEFORGE_FALLBACK_MODEL", "claude-sonnet-4.6"), "hard_debug")
    if any(k in text for k in ["architecture", "refactor", "complex", "design"]):
        return RoutedModel("deepseek", os.getenv("CODEFORGE_COMPLEX_MODEL", "deepseek-v4-pro"), "complex_request")
    return RoutedModel("deepseek", os.getenv("CODEFORGE_DEFAULT_MODEL", "deepseek-v4-flash"), "default_route")


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
        return {
            "backend": "deterministic",
            "provider": route.provider,
            "model": selected_model,
            "reason": route.reason,
            "text": f"Deterministic fallback response for: {prompt[:160]}",
        }
