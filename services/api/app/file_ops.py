from __future__ import annotations

import difflib
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
FILE_PATTERN = re.compile(r"[\w./\\-]+\.[A-Za-z0-9]+")


def _safe_repo_path(candidate: str | None) -> Path | None:
    if not candidate:
        return None

    normalized = candidate.replace("\\", "/").lstrip("/")
    path = (REPO_ROOT / normalized).resolve()

    try:
        path.relative_to(REPO_ROOT)
    except ValueError:
        return None

    if path.is_file():
        return path

    return None


def resolve_repo_path(candidate: str | None) -> Path | None:
    return _safe_repo_path(candidate)


def repo_relative_path(candidate: str | None) -> str | None:
    path = _safe_repo_path(candidate)
    if not path:
        return None
    return path.relative_to(REPO_ROOT).as_posix()


def infer_target_file(prompt: str, current_file: str | None = None) -> str | None:
    explicit = _safe_repo_path(current_file)
    if explicit:
        return explicit.relative_to(REPO_ROOT).as_posix()

    for match in FILE_PATTERN.findall(prompt):
        candidate = _safe_repo_path(match)
        if candidate:
            return candidate.relative_to(REPO_ROOT).as_posix()

    lowered = prompt.lower()
    heuristics = [
        ("billing", "services/api/app/main.py"),
        ("api", "services/api/app/main.py"),
        ("auth", "services/api/app/auth.py"),
        ("terminal", "apps/terminal/src/cli.jsx"),
        ("desktop", "apps/desktop/src/App.jsx"),
        ("web", "apps/web/app/page.jsx"),
        ("ui", "apps/web/app/page.jsx"),
    ]

    for keyword, path in heuristics:
        if keyword in lowered:
            return path

    return "services/api/app/main.py"


def read_file_excerpt(relative_path: str, max_lines: int = 12) -> str:
    path = _safe_repo_path(relative_path)
    if not path:
        return ""

    lines = path.read_text(encoding="utf-8").splitlines()
    excerpt = []
    for index, line in enumerate(lines[:max_lines], start=1):
        excerpt.append(f"{index:>3}: {line}")
    return "\n".join(excerpt)


def read_file_content(relative_path: str) -> str:
    path = _safe_repo_path(relative_path)
    if not path:
        return ""
    return path.read_text(encoding="utf-8")


def read_file_line_count(relative_path: str) -> int:
    path = _safe_repo_path(relative_path)
    if not path:
        return 0
    return len(path.read_text(encoding="utf-8").splitlines())


def _comment_prefix(relative_path: str) -> tuple[str, str] | None:
    suffix = Path(relative_path).suffix.lower()
    if suffix in {".js", ".jsx", ".ts", ".tsx", ".rs", ".java", ".go", ".c", ".cpp", ".h"}:
        return ("// ", "")
    if suffix in {".py", ".sh", ".yml", ".yaml", ".toml"}:
        return ("# ", "")
    if suffix in {".css", ".scss"}:
        return ("/* ", " */")
    if suffix in {".md", ".html"}:
        return ("<!-- ", " -->")
    return None


def generate_proposed_content(relative_path: str, prompt: str, original_content: str) -> str:
    comment_style = _comment_prefix(relative_path)
    if not comment_style or not original_content:
        return original_content

    start, end = comment_style
    note = f"{start}CodeForge proposal: {prompt[:96]}{end}".rstrip()
    lines = original_content.splitlines()

    if any(note == line.strip() for line in lines[:5]):
        return original_content

    insert_at = 0
    if lines and (lines[0].startswith("#!") or lines[0].strip() in {'"use client";', '"use server";', "'use client';", "'use server';"}):
        insert_at = 1

    next_lines = lines[:insert_at] + [note, ""] + lines[insert_at:]
    trailing_newline = "\n" if original_content.endswith("\n") else ""
    return "\n".join(next_lines) + trailing_newline


def build_patch_preview(relative_path: str, prompt: str, excerpt: str, original_content: str | None = None, proposed_content: str | None = None) -> str:
    if original_content is not None and proposed_content is not None and original_content != proposed_content:
        diff = list(
            difflib.unified_diff(
                original_content.splitlines(),
                proposed_content.splitlines(),
                fromfile=relative_path,
                tofile=relative_path,
                lineterm="",
            )
        )
        return "\n".join(diff[:40])

    trimmed_excerpt = excerpt.splitlines()[0] if excerpt else "existing content"
    return (
        "@@ proposal\n"
        f"--- {relative_path}\n"
        f"+++ {relative_path}\n"
        f"- {trimmed_excerpt}\n"
        f"+ change requested: {prompt[:88]}"
    )


def apply_proposed_content(relative_path: str, proposed_content: str) -> bool:
    path = _safe_repo_path(relative_path)
    if not path:
        return False
    path.write_text(proposed_content, encoding="utf-8")
    return True