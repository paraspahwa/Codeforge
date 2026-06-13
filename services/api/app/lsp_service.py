from __future__ import annotations

from typing import Any

from .lsp_plugins import pick_lsp_for_path
from .skills_service import skills_service
from .symbol_search import search_symbols


async def lsp_tool_dispatch(tool_name: str, args: dict[str, Any], project_path: str, *, user_id: str | None = None) -> dict[str, Any]:
    path = str(args.get("path", "")).strip()
    line = int(args.get("line", 1))
    character = int(args.get("character", 0))

    enabled_lsp: set[str] = set()
    if user_id:
        prefs = skills_service.get_preferences(user_id)
        enabled_lsp = set(prefs.get("enabled_extensions") or [])

    active_plugin = pick_lsp_for_path(path, enabled_ids=enabled_lsp) if path else None

    if tool_name == "get_diagnostics":
        diagnostics = await _lint_file(project_path, path, active_plugin)
        payload: dict[str, Any] = {"message": f"{len(diagnostics)} diagnostic(s)", "diagnostics": diagnostics, "path": path}
        if active_plugin:
            payload["lsp_plugin"] = active_plugin["id"]
            payload["lsp_binary"] = active_plugin.get("resolved_binary")
        return payload

    symbol_query = _symbol_at_position(project_path, path, line, character)
    if tool_name == "go_to_definition":
        matches = search_symbols(project_path, symbol_query, limit=5)
        payload = {
            "message": "definition lookup",
            "symbol": symbol_query,
            "locations": matches.get("matches", []),
            "engine": "symbol_search",
        }
        if active_plugin:
            payload["lsp_plugin"] = active_plugin["id"]
            payload["lsp_binary"] = active_plugin.get("resolved_binary")
            payload["engine"] = "lsp_enhanced"
            payload["note"] = f"Using {active_plugin['name']} when binary is available; symbol search fallback active."
        return payload

    if tool_name == "find_references":
        matches = search_symbols(project_path, symbol_query, limit=40)
        payload = {
            "message": f"{matches.get('match_count', 0)} reference(s)",
            "symbol": symbol_query,
            "references": matches.get("matches", []),
            "engine": "symbol_search",
        }
        if active_plugin:
            payload["lsp_plugin"] = active_plugin["id"]
            payload["lsp_binary"] = active_plugin.get("resolved_binary")
            payload["engine"] = "lsp_enhanced"
        return payload

    return {"message": "unsupported lsp tool"}


def _symbol_at_position(project_path: str, path: str, line: int, character: int = 0) -> str:
    from .file_ops import read_file_content
    import re

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


async def _lint_file(project_path: str, path: str, active_plugin: dict[str, Any] | None) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []

    def with_path(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized = []
        for item in items:
            entry = dict(item)
            entry.setdefault("path", path)
            entry.setdefault("severity", "error")
            entry.setdefault("line", 1)
            entry.setdefault("message", "Diagnostic")
            normalized.append(entry)
        return normalized

    if active_plugin and active_plugin["id"] == "pyright-lsp" and path.endswith(".py"):
        from .shell_ops import run_shell_command

        try:
            result = await run_shell_command(
                project_path,
                f"pyright {path}",
                user_id="lsp",
            )
            if result.get("passed"):
                return []
            return with_path([{"severity": "error", "message": result.get("summary", "pyright error"), "line": 1, "source": "pyright-lsp"}])
        except Exception:
            pass

    if path.endswith(".py"):
        from .shell_ops import run_shell_command

        try:
            result = await run_shell_command(
                project_path,
                f"python -m py_compile {path}",
                user_id="lsp",
            )
            if result.get("passed"):
                return diagnostics
            summary = result.get("summary", "compile error")
            line = 1
            import re

            match = re.search(r"line (\d+)", summary)
            if match:
                line = int(match.group(1))
            return with_path([{"severity": "error", "message": summary, "line": line, "source": "python"}])
        except Exception as exc:
            return with_path([{"severity": "error", "message": str(exc), "line": 1, "source": "python"}])

    if path.endswith((".js", ".jsx", ".ts", ".tsx")):
        from .file_ops import read_file_content

        content = read_file_content(project_path, path)
        for index, line in enumerate(content.splitlines(), start=1):
            if "console.log(" in line:
                diagnostics.append(
                    {
                        "path": path,
                        "severity": "warning",
                        "message": "Unexpected console statement",
                        "line": index,
                        "source": "codeforge-lint",
                    }
                )
        return diagnostics[:20]

    return diagnostics
