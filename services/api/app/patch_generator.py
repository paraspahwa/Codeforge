from __future__ import annotations

import re
from dataclasses import dataclass

from .model_router import GenerationClient, choose_model

_generation_client = GenerationClient()

_FENCE_PATTERN = re.compile(r"^```[\w-]*\n?", re.MULTILINE)


@dataclass
class PatchGenerationResult:
    proposed_content: str
    source: str
    backend: str
    changed: bool


def _strip_markdown_fence(text: str) -> str:
    cleaned = text.strip()
    if not cleaned.startswith("```"):
        return cleaned

    lines = cleaned.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip("\n")


def _preserve_trailing_newline(original: str, updated: str) -> str:
    if original.endswith("\n") and updated and not updated.endswith("\n"):
        return updated + "\n"
    return updated


def _heuristic_patch(relative_path: str, prompt: str, original_content: str) -> str:
    lowered = prompt.lower()
    suffix = relative_path.lower().rsplit(".", 1)[-1] if "." in relative_path else ""

    if not original_content.strip():
        if suffix == "py":
            return '"""Module scaffold."""\n\n\ndef main() -> None:\n    pass\n\n\nif __name__ == "__main__":\n    main()\n'
        if suffix in {"js", "jsx", "ts", "tsx"}:
            return 'export function main() {\n  return null;\n}\n'
        if suffix == "md":
            return f"# {relative_path}\n\n{prompt.strip()}\n"
        return f"{prompt.strip()}\n"

    if suffix == "py":
        if any(word in lowered for word in ("add test", "pytest", "unit test")):
            stub = (
                "\n\n"
                "def test_codeforge_generated() -> None:\n"
                f'    """Auto-generated test stub for: {prompt[:80]}"""\n'
                "    assert True\n"
            )
            if stub.strip() not in original_content:
                return _preserve_trailing_newline(original_content, original_content + stub)

        if "add" in lowered and "function" in lowered:
            match = re.search(r"function\s+([a-zA-Z_][\w]*)|def\s+([a-zA-Z_][\w]*)", prompt)
            name = (match.group(1) or match.group(2) if match else None) or "codeforge_helper"
            stub = (
                f"\n\n"
                f"def {name}():\n"
                f'    """Generated for: {prompt[:80]}"""\n'
                "    pass\n"
            )
            if f"def {name}(" not in original_content:
                return _preserve_trailing_newline(original_content, original_content + stub)

        if "fix" in lowered or "bug" in lowered:
            lines = original_content.splitlines()
            for index, line in enumerate(lines):
                if "pass" in line and line.strip() == "pass":
                    indent = line[: len(line) - len(line.lstrip())]
                    lines[index] = f"{indent}return None  # CodeForge fix: {prompt[:48]}"
                    return _preserve_trailing_newline(original_content, "\n".join(lines))

    if suffix in {"js", "jsx", "ts", "tsx"} and "export" in lowered:
        if "export function" not in original_content:
            stub = f"\n\nexport function codeforgeGenerated() {{\n  // {prompt[:72]}\n}}\n"
            return _preserve_trailing_newline(original_content, original_content + stub)

    # Targeted append for generic text edits
    note_line = f"# CodeForge change: {prompt[:96]}"
    if suffix == "py":
        note_line = f"# CodeForge change: {prompt[:96]}"
    elif suffix in {"js", "jsx", "ts", "tsx"}:
        note_line = f"// CodeForge change: {prompt[:96]}"
    elif suffix == "md":
        note_line = f"\n\n> {prompt[:96]}\n"

    if note_line.strip() in original_content:
        return original_content

    return _preserve_trailing_newline(original_content, original_content.rstrip() + "\n" + note_line + "\n")


async def generate_proposed_content_async(
    relative_path: str,
    prompt: str,
    original_content: str,
    *,
    model_hint: str | None = None,
) -> PatchGenerationResult:
    route = choose_model(prompt)
    model_name = model_hint or route.model

    system_prompt = (
        "You are CodeForge file editor. Return ONLY the complete updated file content. "
        "Do not wrap the answer in markdown fences. Do not add commentary. "
        "Preserve unrelated code and apply a minimal correct change."
    )
    user_prompt = (
        f"File: {relative_path}\n"
        f"User request: {prompt}\n\n"
        "Current file content:\n"
        f"{original_content}"
    )

    response = await _generation_client.generate(
        prompt=user_prompt,
        system_prompt=system_prompt,
        max_tokens=4096,
    )
    backend = str(response.get("backend", "deterministic"))
    raw_text = str(response.get("text", "")).strip()

    if backend == "litellm" and raw_text:
        candidate = _strip_markdown_fence(raw_text)
        candidate = _preserve_trailing_newline(original_content, candidate)
        if candidate and candidate != original_content:
            return PatchGenerationResult(
                proposed_content=candidate,
                source="llm",
                backend=backend,
                changed=True,
            )

    heuristic = _heuristic_patch(relative_path, prompt, original_content)
    changed = heuristic != original_content
    return PatchGenerationResult(
        proposed_content=heuristic,
        source="heuristic" if changed else "unchanged",
        backend=backend,
        changed=changed,
    )
