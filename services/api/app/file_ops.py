from __future__ import annotations

import difflib
import os
import re
from pathlib import Path


class FileOpsError(ValueError):
    pass


FILE_PATTERN = re.compile(r"[\w./\\-]+\.[A-Za-z0-9]+")


def resolve_project_root(project_path: str) -> Path:
    root = Path(project_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileOpsError("Project path does not exist")
    return root


def _fallback_project_root() -> Path | None:
    configured = os.getenv("CODEFORGE_REPO_ROOT")
    if configured:
        configured_path = Path(configured).expanduser().resolve()
        if configured_path.exists() and configured_path.is_dir():
            return configured_path

    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "package.json").exists() and (parent / "services").exists():
            return parent

    return None


def _project_root(project_path: str | None) -> Path:
    if project_path:
        return resolve_project_root(project_path)
    fallback = _fallback_project_root()
    if fallback is not None:
        return fallback
    raise FileOpsError("Project path is required")


def _safe_project_path(project_root: Path, candidate: str | None) -> Path | None:
    if not candidate:
        return None

    normalized = candidate.replace("\\", "/").lstrip("/")
    path = (project_root / normalized).resolve()

    try:
        path.relative_to(project_root)
    except ValueError:
        return None

    if path.is_file():
        return path

    return None


def resolve_repo_path(project_path: str | None, candidate: str | None) -> Path | None:
    try:
        project_root = _project_root(project_path)
    except FileOpsError:
        return None
    return _safe_project_path(project_root, candidate)


def repo_relative_path(project_path: str | None, candidate: str | None) -> str | None:
    try:
        project_root = _project_root(project_path)
    except FileOpsError:
        return None
    path = _safe_project_path(project_root, candidate)
    if not path:
        return None
    return path.relative_to(project_root).as_posix()


def _find_entry_file(project_root: Path, prompt: str) -> str | None:
    lowered = prompt.lower()

    if any(
        keyword in lowered
        for keyword in ["api", "auth", "endpoint", "login", "fastapi", "flask", "route", "rest"]
    ):
        if any(word in lowered for word in ["auth", "login", "sign in", "signin"]):
            return "auth_api.py"
        for relative_path in ("api.py", "main.py", "app.py"):
            if _safe_project_path(project_root, relative_path):
                return relative_path
        return "api.py"

    if any(
        keyword in lowered
        for keyword in ["python", "hello world", ".py", "write code", "write a", "program", "script"]
    ):
        if "hello" in lowered:
            return "hello.py"
        for relative_path in ("main.py", "app.py", "hello.py"):
            if _safe_project_path(project_root, relative_path):
                return relative_path
        return "main.py"

    candidates = [
        ("readme", "README.md"),
        ("package", "package.json"),
        ("main", "main.py"),
        ("index", "index.js"),
        ("app", "app.py"),
    ]
    for keyword, relative_path in candidates:
        if keyword in lowered and _safe_project_path(project_root, relative_path):
            return relative_path

    for relative_path in ("README.md", "package.json", "src/main.py", "main.py", "index.js", "index.ts"):
        if _safe_project_path(project_root, relative_path):
            return relative_path

    return None


def list_workspace_files(project_path: str | None, *, max_files: int = 300) -> list[str]:
    try:
        project_root = _project_root(project_path)
    except FileOpsError:
        return []

    skip_dirs = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".next", "target"}
    files: list[str] = []
    for path in sorted(project_root.rglob("*")):
        if not path.is_file():
            continue
        if any(part in skip_dirs for part in path.parts):
            continue
        files.append(path.relative_to(project_root).as_posix())
        if len(files) >= max_files:
            break
    return files


def infer_target_file(
    project_path: str | None,
    prompt: str,
    current_file: str | None = None,
) -> str | None:
    try:
        project_root = _project_root(project_path)
    except FileOpsError:
        return None

    explicit = _safe_project_path(project_root, current_file)
    if explicit:
        return explicit.relative_to(project_root).as_posix()

    for match in FILE_PATTERN.findall(prompt):
        candidate = _safe_project_path(project_root, match)
        if candidate:
            return candidate.relative_to(project_root).as_posix()

    return _find_entry_file(project_root, prompt)


def read_file_excerpt(project_path: str | None, relative_path: str, max_lines: int = 12) -> str:
    try:
        project_root = _project_root(project_path)
    except FileOpsError:
        return ""

    path = _safe_project_path(project_root, relative_path)
    if not path:
        return ""

    lines = path.read_text(encoding="utf-8").splitlines()
    excerpt = []
    for index, line in enumerate(lines[:max_lines], start=1):
        excerpt.append(f"{index:>3}: {line}")
    return "\n".join(excerpt)


def read_file_content(project_path: str | None, relative_path: str) -> str:
    try:
        project_root = _project_root(project_path)
    except FileOpsError:
        return ""

    path = _safe_project_path(project_root, relative_path)
    if not path:
        return ""
    return path.read_text(encoding="utf-8")


def read_file_line_count(project_path: str | None, relative_path: str) -> int:
    try:
        project_root = _project_root(project_path)
    except FileOpsError:
        return 0

    path = _safe_project_path(project_root, relative_path)
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


def build_patch_preview(
    relative_path: str,
    prompt: str,
    excerpt: str,
    original_content: str | None = None,
    proposed_content: str | None = None,
) -> str:
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


def apply_proposed_content(project_path: str | None, relative_path: str, proposed_content: str) -> bool:
    try:
        project_root = _project_root(project_path)
    except FileOpsError:
        return False

    path = _safe_project_path(project_root, relative_path)
    if not path:
        # Allow creating a new file inside the project when the parent directory exists.
        normalized = relative_path.replace("\\", "/").lstrip("/")
        target = (project_root / normalized).resolve()
        try:
            target.relative_to(project_root)
        except ValueError:
            return False
        if target.exists() and not target.is_file():
            return False
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(proposed_content, encoding="utf-8")
        return True

    path.write_text(proposed_content, encoding="utf-8")
    return True
