from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Any

from .state import generation_client


def vision_model() -> str:
    return os.getenv("CODEFORGE_VISION_MODEL", os.getenv("CODEFORGE_SYNTHESIS_MODEL", "gpt-4o-mini"))


async def extract_text_from_image_bytes(image_bytes: bytes, *, prompt: str | None = None) -> dict[str, Any]:
    if not image_bytes:
        return {"text": "", "method": "empty", "warnings": ["No image bytes provided"]}

    encoded = base64.b64encode(image_bytes).decode("ascii")
    user_prompt = prompt or "Extract all visible text and summarize the page structure. Return plain text only."
    data_url = f"data:image/png;base64,{encoded}"

    try:
        import litellm  # type: ignore

        response = await litellm.acompletion(
            model=vision_model(),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            max_tokens=800,
        )
        text = response.choices[0].message.content if response and response.choices else ""
        return {"text": str(text or "").strip(), "method": "vision_model", "warnings": []}
    except Exception as exc:
        fallback = await generation_client.generate(
            f"{user_prompt}\n\n[Vision unavailable; image size={len(image_bytes)} bytes]",
            max_tokens=240,
            model=vision_model(),
        )
        return {
            "text": fallback.get("text", ""),
            "method": "vision_fallback",
            "warnings": [f"Vision model failed: {exc}"],
        }


async def extract_text_from_image_path(image_path: Path, *, prompt: str | None = None) -> dict[str, Any]:
    return await extract_text_from_image_bytes(image_path.read_bytes(), prompt=prompt)
