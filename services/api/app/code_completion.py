from __future__ import annotations

import os
import re
from typing import Any

from .model_router import GenerationClient

_generation_client = GenerationClient()

_PY_IMPORTS = {
    "fastapi": "from fastapi import APIRouter, HTTPException\n",
    "pydantic": "from pydantic import BaseModel\n",
    "typing": "from typing import Any\n",
    "os": "import os\n",
    "json": "import json\n",
}

_JS_SNIPPETS = {
    "console.": "log(",
    "export default": " function Component() {\n  return null;\n}\n",
    "import React": " from 'react';\n",
}


def _suffix_for_path(relative_path: str, prefix: str) -> str | None:
    lowered_path = relative_path.lower()
    stripped = prefix.rstrip()
    tail = prefix[len(stripped) :] if stripped else prefix

    if stripped.endswith("import") and (tail.startswith(" ") or tail == "") and lowered_path.endswith(".py"):
        return "os"
    if stripped.endswith("from") and (tail.startswith(" ") or tail == ""):
        if lowered_path.endswith(".py"):
            return "fastapi import APIRouter"

    for key, value in _PY_IMPORTS.items():
        if stripped.endswith(key):
            return value[len(key) :].lstrip() or None

    for key, value in _JS_SNIPPETS.items():
        if stripped.endswith(key):
            return value

    if stripped.endswith("def ") and lowered_path.endswith(".py"):
        return "handler():\n    pass"

    if stripped.endswith("async def ") and lowered_path.endswith(".py"):
        return "handler():\n    pass"

    if re.search(r"\bif\s+[\w.]+\s*:\s*$", stripped) and lowered_path.endswith(".py"):
        return "\n    pass"

    if stripped.endswith("return "):
        if lowered_path.endswith(".py"):
            return '{"status": "ok"}'
        if lowered_path.endswith((".ts", ".tsx", ".js", ".jsx")):
            return "null;"

    return None


async def suggest_code_completion(
    *,
    relative_path: str,
    content: str,
    line_number: int,
    column: int,
) -> dict[str, Any]:
    lines = content.splitlines()
    line_idx = max(0, min(max(line_number, 1) - 1, len(lines) - 1)) if lines else 0
    current_line = lines[line_idx] if lines else ""
    col = max(1, min(column, len(current_line) + 1))
    prefix = current_line[: col - 1]

    heuristic = _suffix_for_path(relative_path, prefix)
    if heuristic:
        return {"completion": heuristic, "source": "heuristic", "backend": "deterministic"}

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not openai_key or not prefix.strip():
        return {"completion": "", "source": "none", "backend": "deterministic"}

    context_start = max(0, line_idx - 12)
    context = "\n".join(lines[context_start : line_idx + 1])
    system_prompt = (
        "You are a code completion engine. Return ONLY the text to insert at the cursor — "
        "no markdown, no explanation, no quotes. Keep it under 80 characters."
    )
    user_prompt = (
        f"File: {relative_path}\n"
        f"Cursor prefix on current line: {prefix!r}\n\n"
        f"Recent context:\n{context}\n\n"
        "Completion:"
    )

    response = await _generation_client.generate(
        prompt=user_prompt,
        system_prompt=system_prompt,
        max_tokens=64,
    )
    text = str(response.get("text", "")).strip()
    if text.startswith("```"):
        text = re.sub(r"^```[\w-]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()

    backend = str(response.get("backend", "deterministic"))
    if text and backend == "litellm":
        return {"completion": text, "source": "llm", "backend": backend}

    return {"completion": "", "source": "none", "backend": backend}
