from __future__ import annotations

import asyncio
import re
from typing import Any

from .symbol_search import search_symbols


async def lsp_tool_dispatch(tool_name: str, args: dict[str, Any], project_path: str) -> dict[str, Any]:
    path = str(args.get("path", "")).strip()
    line = int(args.get("line", 1))
    character = int(args.get("character", 0))

    if tool_name == "get_diagnostics":
        diagnostics = await _lint_file(project_path, path)
        return {"message": f"{len(diagnostics)} diagnostic(s)", "diagnostics": diagnostics, "path": path}

    symbol_query = _symbol_at_position(project_path, path, line, character)
    if tool_name == "go_to_definition":
        matches = search_symbols(project_path, symbol_query, limit=5)
        return {
            "message": "definition lookup",
            "symbol": symbol_query,
            "locations": matches.get("matches", []),
        }

    if tool_name == "find_references":
        matches = search_symbols(project_path, symbol_query, limit=40)
        return {
            "message": f"{matches.get('match_count', 0)} reference(s)",
            "symbol": symbol_query,
            "references": matches.get("matches", []),
        }

    return {"message": "unsupported lsp tool"}


def _symbol_at_position(project_path: str, path: str, line: int, character: int = 0) -> str:
    from .file_ops import read_file_content

    content = read_file_content(project_path, path)
    lines = content.splitlines()
    if not lines or line < 1 or line > len(lines):
        return ""
    text = lines[line - 1]
    slice_text = text[character:] if character < len(text) else text
    match = re.search(r"\b([A-Za-z_][\w]*)", slice_text)
    if match:
        return match.group(1)
    tokens = re.findall(r"\b[A-Za-z_][\w]*\b", text)
    return tokens[-1] if tokens else ""


async def _lint_file(project_path: str, path: str) -> list[dict[str, Any]]:
    if not path.endswith(".py"):
        return []
    from .shell_ops import run_shell_command

    try:
        result = await run_shell_command(
            project_path,
            f"python -m py_compile {path}",
            user_id="lsp",
        )
        if result.get("passed"):
            return []
        return [{"severity": "error", "message": result.get("summary", "compile error"), "line": 1}]
    except Exception as exc:
        return [{"severity": "error", "message": str(exc), "line": 1}]
