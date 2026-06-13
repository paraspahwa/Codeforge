from __future__ import annotations

import ast
import re
import subprocess
from pathlib import Path
from typing import Any

from .file_ops import FileOpsError, _project_root, _safe_project_path

_SYMBOL_PATTERN = re.compile(r"\b(def|class|async def|function|const|let|var|interface|type)\s+([A-Za-z_][\w]*)")
_SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".next", "target"}


class SymbolSearchError(RuntimeError):
    pass


def _python_symbols(path: Path, query: str, relative: str) -> list[dict[str, Any]]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError, UnicodeDecodeError):
        return []

    lowered = query.lower()
    matches: list[dict[str, Any]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            if lowered in node.name.lower():
                matches.append(
                    {
                        "symbol": node.name,
                        "kind": "class",
                        "file": relative,
                        "line": node.lineno,
                    }
                )
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if lowered in node.name.lower():
                matches.append(
                    {
                        "symbol": node.name,
                        "kind": "function",
                        "file": relative,
                        "line": node.lineno,
                    }
                )
    return matches


def _regex_symbols(path: Path, query: str, relative: str) -> list[dict[str, Any]]:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    lowered = query.lower()
    matches: list[dict[str, Any]] = []
    for index, line in enumerate(text.splitlines(), start=1):
        for match in _SYMBOL_PATTERN.finditer(line):
            symbol = match.group(2)
            if lowered in symbol.lower():
                matches.append(
                    {
                        "symbol": symbol,
                        "kind": match.group(1).replace("async ", ""),
                        "file": relative,
                        "line": index,
                    }
                )
    return matches


def _ripgrep_symbols(project_root: Path, query: str, limit: int) -> list[dict[str, Any]]:
    pattern = rf"\b(def|class|async def|function|const|let|var|interface|type)\s+{re.escape(query)}\b"
    try:
        completed = subprocess.run(
            [
                "rg",
                "-n",
                "--no-heading",
                "--max-count",
                str(limit),
                "-S",
                pattern,
                str(project_root),
            ],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []

    if completed.returncode not in {0, 1} or not completed.stdout.strip():
        return []

    matches: list[dict[str, Any]] = []
    for line in completed.stdout.splitlines():
        parts = line.split(":", 2)
        if len(parts) < 3:
            continue
        file_path, line_no, content = parts[0], parts[1], parts[2]
        relative = Path(file_path).resolve().relative_to(project_root).as_posix()
        symbol_match = _SYMBOL_PATTERN.search(content)
        if not symbol_match:
            continue
        matches.append(
            {
                "symbol": symbol_match.group(2),
                "kind": symbol_match.group(1).replace("async ", ""),
                "file": relative,
                "line": int(line_no),
            }
        )
    return matches


def search_symbols(project_path: str | None, query: str, *, limit: int = 40) -> dict[str, Any]:
    cleaned = query.strip()
    if not cleaned:
        raise SymbolSearchError("Symbol query is required")

    try:
        project_root = _project_root(project_path)
    except FileOpsError as exc:
        raise SymbolSearchError(str(exc)) from exc

    capped = max(1, min(limit, 80))
    matches: list[dict[str, Any]] = []
    seen: set[tuple[str, str, int]] = set()

    for item in _ripgrep_symbols(project_root, cleaned, capped):
        key = (item["file"], item["symbol"], item["line"])
        if key not in seen:
            seen.add(key)
            matches.append(item)
        if len(matches) >= capped:
            break

    if len(matches) < capped:
        for path in sorted(project_root.rglob("*")):
            if not path.is_file():
                continue
            if any(part in _SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() not in {".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java"}:
                continue
            relative = path.relative_to(project_root).as_posix()
            if _safe_project_path(project_root, relative) is None:
                continue
            finder = _python_symbols if path.suffix.lower() == ".py" else _regex_symbols
            for item in finder(path, cleaned, relative):
                key = (item["file"], item["symbol"], item["line"])
                if key in seen:
                    continue
                seen.add(key)
                matches.append(item)
                if len(matches) >= capped:
                    break
            if len(matches) >= capped:
                break

    file_hits = [
        path.relative_to(project_root).as_posix()
        for path in sorted(project_root.rglob("*"))
        if path.is_file()
        and cleaned.lower() in path.name.lower()
        and not any(part in _SKIP_DIRS for part in path.parts)
    ][:10]

    return {
        "query": cleaned,
        "match_count": len(matches),
        "matches": matches[:capped],
        "file_hits": file_hits,
    }
