"""Session chat attachments — upload, extract text, inject into agent context."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any
from uuid import uuid4

from .cowork import extract_structured_data

_ATTACHMENT_DIR = ".codeforge/chat-attachments"
_MAX_UPLOAD_BYTES = 12_000_000
_MAX_FILES = 8
_ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".md",
    ".markdown",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".csv",
    ".html",
    ".htm",
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".doc",
    ".docx",
}


class SessionAttachmentError(RuntimeError):
    pass


def _sanitize_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\-]+", "_", base).strip("._")
    return cleaned[:120] or "attachment.bin"


def _sanitize_session_id(session_id: str) -> str:
    cleaned = re.sub(r"[^\w\-]+", "_", session_id).strip("._")
    if not cleaned:
        raise SessionAttachmentError("Invalid session_id")
    return cleaned


def _attachment_root(project_path: str, session_id: str) -> Path:
    safe_session = _sanitize_session_id(session_id)
    root = Path(project_path).expanduser().resolve() / _ATTACHMENT_DIR / safe_session
    root.mkdir(parents=True, exist_ok=True)
    return root


def _manifest_path(project_path: str, session_id: str) -> Path:
    return _attachment_root(project_path, session_id) / "manifest.json"


def _load_manifest(project_path: str, session_id: str) -> list[dict[str, Any]]:
    path = _manifest_path(project_path, session_id)
    if not path.is_file():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return payload if isinstance(payload, list) else []


def _save_manifest(project_path: str, session_id: str, rows: list[dict[str, Any]]) -> None:
    path = _manifest_path(project_path, session_id)
    path.write_text(json.dumps(rows, ensure_ascii=True, indent=2), encoding="utf-8")


def upload_session_attachments(
    *,
    project_path: str,
    session_id: str,
    uploads: list[tuple[str, bytes]],
) -> list[dict[str, Any]]:
    if not uploads:
        raise SessionAttachmentError("No files uploaded")
    if len(uploads) > _MAX_FILES:
        raise SessionAttachmentError(f"Maximum {_MAX_FILES} files per upload")

    root = _attachment_root(project_path, session_id)
    manifest = _load_manifest(project_path, session_id)
    saved: list[dict[str, Any]] = []

    for filename, raw in uploads:
        if len(raw) > _MAX_UPLOAD_BYTES:
            raise SessionAttachmentError(f"{filename} exceeds size limit")
        safe_name = _sanitize_filename(filename)
        suffix = Path(safe_name).suffix.lower()
        if suffix and suffix not in _ALLOWED_EXTENSIONS:
            raise SessionAttachmentError(f"Unsupported file type: {suffix}")

        attachment_id = f"att_{uuid4().hex[:10]}"
        target = root / f"{attachment_id}_{safe_name}"
        target.write_bytes(raw)

        relative = target.relative_to(Path(project_path).expanduser().resolve()).as_posix()
        try:
            extracted = extract_structured_data(project_path, relative)
            excerpt = str(extracted.get("text_excerpt") or "")
            method = str(extracted.get("method") or "upload")
        except Exception:
            excerpt = ""
            method = "binary"

        if suffix == ".pdf" and not excerpt.strip():
            excerpt = _extract_pdf_text(target) or f"[PDF attachment: {safe_name}]"

        row = {
            "attachment_id": attachment_id,
            "name": safe_name,
            "path": relative,
            "kind": suffix.lstrip(".") or "file",
            "byte_size": len(raw),
            "excerpt": excerpt[:4000],
            "method": method,
        }
        manifest.append(row)
        saved.append(row)

    _save_manifest(project_path, session_id, manifest[-50:])
    return saved


def list_session_attachments(*, project_path: str, session_id: str) -> list[dict[str, Any]]:
    return _load_manifest(project_path, session_id)


def compose_attached_files_context(*, project_path: str, attached_files: list[str]) -> str:
    if not attached_files or not project_path:
        return ""

    root = Path(project_path).expanduser().resolve()
    blocks: list[str] = []

    for ref in attached_files:
        ref = str(ref).strip()
        if not ref:
            continue
        resolved = (root / ref).resolve()
        try:
            resolved.relative_to(root)
        except ValueError:
            continue
        if not resolved.is_file():
            continue

        relative = resolved.relative_to(root).as_posix()
        try:
            extracted = extract_structured_data(project_path, relative)
            excerpt = str(extracted.get("text_excerpt") or "").strip()
            method = extracted.get("method", "file")
        except Exception:
            excerpt = ""
            method = "unavailable"

        if not excerpt and resolved.suffix.lower() == ".pdf":
            excerpt = _extract_pdf_text(resolved) or "[PDF content could not be extracted]"

        if not excerpt:
            excerpt = f"[Binary or empty file: {relative}]"

        blocks.append(f"### Attached: {relative}\n{excerpt[:3500]}")

    if not blocks:
        return ""
    return "User attached files for this message:\n\n" + "\n\n".join(blocks)


def _extract_pdf_text(path: Path) -> str:
    pdftotext = shutil.which("pdftotext")
    if pdftotext:
        try:
            completed = subprocess.run(
                [pdftotext, "-layout", str(path), "-"],
                check=False,
                capture_output=True,
                text=True,
                timeout=25,
            )
            if completed.stdout.strip():
                return completed.stdout.strip()[:8000]
        except Exception:
            pass
    return ""
