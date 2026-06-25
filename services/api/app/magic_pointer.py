from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

OPEN_TAG = "[ACTIVE_CURSOR_CONTEXT]"
CLOSE_TAG = "[/ACTIVE_CURSOR_CONTEXT]"

_DEICTIC_INSTRUCTION = (
    "Deictic resolution: interpret 'this', 'that', 'it', 'here', and phrases like "
    "'this function' or 'this file' as referring to the ACTIVE_CURSOR_CONTEXT block below. "
    "Do not ask the user to paste code already shown in Selected Text or Cursor Line."
)

_ENTITY_RULES: list[tuple[str, re.Pattern[str], list[str]]] = [
    (
        "api_route",
        re.compile(r"@(?:app|router)\.(?:get|post|put|patch|delete|websocket)\([\"']([^\"']+)", re.I),
        [
            "Open the router module that registers this route",
            "Trace handler implementation and request/response models",
            "Run API tests covering this endpoint",
        ],
    ),
    (
        "http_path",
        re.compile(r"[\"'](/api/[^\"']+)[\"']"),
        [
            "Find FastAPI route or Next.js BFF handler for this path",
            "Check infra/gateway/nginx.conf proxy rules",
        ],
    ),
    (
        "npm_missing",
        re.compile(r"Cannot find module ['\"]([^'\"]+)['\"]"),
        ["Run npm install in the relevant workspace", "Add package to package.json"],
    ),
    (
        "pytest_failure",
        re.compile(r"(FAILED|AssertionError|pytest\.fail)", re.I),
        ["Run npm run api:test", "Apply Loop Engineering verify/fix protocol"],
    ),
    (
        "import_statement",
        re.compile(r"(?:from|import)\s+([\w.]+)"),
        ["Jump to module definition", "Verify dependency in requirements.txt or package.json"],
    ),
    (
        "terminal_error",
        re.compile(r"(Error:|Traceback \(most recent call last\)|npm ERR!|ELIFECYCLE)", re.I),
        ["Capture full stderr", "Run Loop Engineering on the failing command"],
    ),
]


@dataclass(frozen=True)
class DetectedEntity:
    kind: str
    value: str
    suggested_actions: list[str]


def detect_entities(text: str) -> list[DetectedEntity]:
    if not text.strip():
        return []

    found: list[DetectedEntity] = []
    seen: set[tuple[str, str]] = set()
    for kind, pattern, actions in _ENTITY_RULES:
        for match in pattern.finditer(text):
            value = next((group for group in match.groups() if group), match.group(0))
            key = (kind, value)
            if key in seen:
                continue
            seen.add(key)
            found.append(DetectedEntity(kind=kind, value=value, suggested_actions=actions))
    return found


def _clip(text: str, limit: int = 4000) -> str:
    if len(text) <= limit:
        return text
    return f"{text[: limit - 20]}\n...[truncated]"


def compose_active_cursor_context(
    *,
    file_path: str | None,
    line_number: int | None = None,
    selection_start_line: int | None = None,
    selection_end_line: int | None = None,
    selection_text: str | None = None,
    cursor_line_text: str | None = None,
    surrounding_context: str | None = None,
    include_deictic_instruction: bool = True,
) -> str:
    selection = (selection_text or "").strip()
    cursor_line = (cursor_line_text or "").strip()
    if not file_path and not selection and not cursor_line:
        return ""

    lines: list[str] = [OPEN_TAG]
    if include_deictic_instruction:
        lines.append(_DEICTIC_INSTRUCTION)

    if file_path:
        lines.append(f"File: {file_path}")
    if line_number:
        lines.append(f"Line: {line_number}")
    if selection_start_line and selection_end_line:
        lines.append(f"Selection Range: lines {selection_start_line}-{selection_end_line}")

    if selection:
        lines.append("Selected Text:")
        lines.append(_clip(selection))
    elif cursor_line:
        lines.append("Cursor Line:")
        lines.append(_clip(cursor_line))

    if surrounding_context and surrounding_context.strip():
        lines.append("Surrounding:")
        lines.append(_clip(surrounding_context.strip()))

    probe_text = selection or cursor_line or surrounding_context or ""
    entities = detect_entities(probe_text)
    if entities:
        lines.append("Detected Entities:")
        for entity in entities[:8]:
            actions = "; ".join(entity.suggested_actions[:2])
            lines.append(f"- {entity.kind}: {entity.value} → {actions}")

    lines.append(CLOSE_TAG)
    return "\n".join(lines)


def compose_from_message_context(context: dict[str, Any]) -> str:
    return compose_active_cursor_context(
        file_path=context.get("current_file"),
        line_number=context.get("line_number"),
        selection_start_line=context.get("selection_start_line"),
        selection_end_line=context.get("selection_end_line"),
        selection_text=context.get("selection_text"),
        cursor_line_text=context.get("cursor_line_text"),
        surrounding_context=context.get("surrounding_context"),
    )


def serialize_entities(context: dict[str, Any]) -> list[dict[str, Any]]:
    probe = " ".join(
        filter(
            None,
            [
                context.get("selection_text"),
                context.get("cursor_line_text"),
                context.get("surrounding_context"),
            ],
        )
    )
    return [
        {"kind": item.kind, "value": item.value, "suggested_actions": item.suggested_actions}
        for item in detect_entities(probe)
    ]
