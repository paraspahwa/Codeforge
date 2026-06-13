from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .cowork import CoworkError, _normalize_within_project


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _undo_dir(project_path: str) -> Path:
    root = Path(project_path).expanduser().resolve()
    target = root / ".codeforge" / "cowork" / "undo"
    target.mkdir(parents=True, exist_ok=True)
    return target


def preview_organize_by_date(project_path: str, source_path: str, *, pattern: str = "YYYY-MM-DD") -> dict[str, Any]:
    resolved = _normalize_within_project(project_path, source_path)
    if not resolved.is_dir():
        raise CoworkError("Organize-by-date requires a directory path")

    moves: list[dict[str, str]] = []
    for item in sorted(resolved.iterdir()):
        if item.name.startswith("."):
            continue
        if not item.is_file():
            continue
        stamp = datetime.fromtimestamp(item.stat().st_mtime, tz=timezone.utc)
        folder = stamp.strftime("%Y-%m-%d") if pattern == "YYYY-MM-DD" else stamp.strftime("%Y/%m")
        target_dir = resolved / folder
        target_path = target_dir / item.name
        if item.resolve() == target_path.resolve():
            continue
        moves.append(
            {
                "from": item.relative_to(Path(project_path).resolve()).as_posix(),
                "to": target_path.relative_to(Path(project_path).resolve()).as_posix(),
            }
        )

    return {
        "action": "organize_by_date",
        "source_path": resolved.as_posix(),
        "pattern": pattern,
        "move_count": len(moves),
        "moves": moves[:50],
        "truncated": len(moves) > 50,
    }


def preview_rename_pattern(
    project_path: str,
    source_path: str,
    *,
    prefix: str = "",
    suffix: str = "",
    replace_spaces: bool = True,
) -> dict[str, Any]:
    resolved = _normalize_within_project(project_path, source_path)
    targets: list[dict[str, str]] = []

    paths = [resolved] if resolved.is_file() else [p for p in resolved.iterdir() if p.is_file() and not p.name.startswith(".")]
    for item in sorted(paths):
        stem = item.stem
        if replace_spaces:
            stem = re.sub(r"\s+", "-", stem.strip())
        new_name = f"{prefix}{stem}{suffix}{item.suffix}"
        if new_name == item.name:
            continue
        new_path = item.with_name(new_name)
        targets.append(
            {
                "from": item.relative_to(Path(project_path).resolve()).as_posix(),
                "to": new_path.relative_to(Path(project_path).resolve()).as_posix(),
            }
        )

    return {
        "action": "rename_pattern",
        "source_path": resolved.as_posix(),
        "rename_count": len(targets),
        "renames": targets[:50],
        "truncated": len(targets) > 50,
    }


def execute_file_operations(project_path: str, operations: list[dict[str, Any]], *, dry_run: bool = False) -> dict[str, Any]:
    if not operations:
        raise CoworkError("No file operations provided")

    root = Path(project_path).expanduser().resolve()
    changelog: list[dict[str, str]] = []
    applied = 0
    errors: list[str] = []

    for op in operations:
        action = str(op.get("action", "")).strip()
        try:
            if action == "mkdir":
                rel = str(op.get("path", "")).strip()
                target = (root / rel).resolve()
                target.relative_to(root)
                if not dry_run:
                    target.mkdir(parents=True, exist_ok=True)
                changelog.append({"action": "mkdir", "path": rel})
                applied += 1
            elif action in {"move", "rename"}:
                src = _normalize_within_project(project_path, str(op.get("from", "")))
                dest_rel = str(op.get("to", "")).strip()
                dest = (root / dest_rel).resolve()
                dest.relative_to(root)
                if not dry_run:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(src), str(dest))
                changelog.append({"action": action, "from": src.as_posix(), "to": dest.as_posix()})
                applied += 1
            elif action == "copy":
                src = _normalize_within_project(project_path, str(op.get("from", "")))
                dest = (root / str(op.get("to", "")).strip()).resolve()
                dest.relative_to(root)
                if not dry_run:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(str(src), str(dest))
                changelog.append({"action": "copy", "from": src.as_posix(), "to": dest.as_posix()})
                applied += 1
            else:
                errors.append(f"Unsupported operation: {action}")
        except (CoworkError, OSError, ValueError) as exc:
            errors.append(str(exc))

    undo_id = f"undo_{uuid4().hex[:10]}"
    undo_payload = {"undo_id": undo_id, "operations": changelog, "created_at": _utc_now_iso()}
    if not dry_run and changelog:
        undo_file = _undo_dir(project_path) / f"{undo_id}.json"
        undo_file.write_text(json.dumps(undo_payload, indent=2), encoding="utf-8")

    return {
        "status": "completed" if not errors else ("partial" if applied else "failed"),
        "summary": f"Applied {applied} file operation(s)" + (f"; {len(errors)} error(s)" if errors else ""),
        "applied": applied,
        "changelog": changelog,
        "errors": errors,
        "undo_id": undo_id if changelog and not dry_run else None,
        "dry_run": dry_run,
    }


def build_organize_moves(project_path: str, source_path: str, *, pattern: str = "YYYY-MM-DD") -> list[dict[str, Any]]:
    preview = preview_organize_by_date(project_path, source_path, pattern=pattern)
    operations: list[dict[str, Any]] = []
    for move in preview.get("moves", []):
        parent = str(Path(move["to"]).parent)
        operations.append({"action": "mkdir", "path": parent})
        operations.append({"action": "move", "from": move["from"], "to": move["to"]})
    return operations


def build_rename_operations(project_path: str, source_path: str, **kwargs: Any) -> list[dict[str, Any]]:
    preview = preview_rename_pattern(project_path, source_path, **kwargs)
    return [{"action": "rename", "from": item["from"], "to": item["to"]} for item in preview.get("renames", [])]
