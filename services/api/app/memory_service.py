from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from . import memory_store
from .state import vector_store

MAX_CONTEXT_ITEMS = 5
MAX_CONTEXT_CHARS = 500
SIGNAL_KEYWORDS = ("remember", "architecture", "decision", "bug", "fix", "decided", "chose", "prefer")
_KIND_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("bug", re.compile(r"\b(bug|fix|broken|error|failing)\b", re.IGNORECASE)),
    ("architecture", re.compile(r"\b(architecture|pattern|design|structure|monorepo)\b", re.IGNORECASE)),
    ("decision", re.compile(r"\b(decision|decided|chose|choose|prefer|instead of)\b", re.IGNORECASE)),
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def project_id_from_path(project_path: str | None) -> str:
    normalized = (project_path or "global").strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def content_hash(content: str) -> str:
    return hashlib.sha256(content.strip().lower().encode("utf-8")).hexdigest()[:24]


def classify_kind(text: str) -> str:
    for kind, pattern in _KIND_PATTERNS:
        if pattern.search(text):
            return kind
    return "note"


def should_capture_signal(text: str) -> bool:
    lowered = (text or "").lower()
    return any(keyword in lowered for keyword in SIGNAL_KEYWORDS)


def save_memory(
    *,
    user_id: str,
    content: str,
    project_path: str | None = None,
    scope: str = "personal",
    kind: str | None = None,
    source_session_id: str | None = None,
) -> dict[str, Any]:
    cleaned = " ".join((content or "").split()).strip()
    if not cleaned:
        raise ValueError("Memory content cannot be empty")
    if scope not in {"personal", "team"}:
        raise ValueError("scope must be personal or team")

    digest = content_hash(cleaned)
    existing = memory_store.get_memory_by_hash(user_id, digest)
    if existing:
        return existing

    project_id = project_id_from_path(project_path)
    memory_kind = kind or classify_kind(cleaned)
    memory_id = f"mem_{uuid4().hex[:12]}"
    created_at = _utc_now_iso()
    row = {
        "memory_id": memory_id,
        "user_id": user_id,
        "project_id": project_id,
        "scope": scope,
        "kind": memory_kind,
        "content": cleaned[:2000],
        "content_hash": digest,
        "source_session_id": source_session_id,
        "created_at": created_at,
    }
    memory_store.insert_agent_memory(row)
    vector_store.upsert_text(
        memory_id,
        cleaned[:2000],
        metadata={
            "type": "agent_memory",
            "user_id": user_id,
            "project_id": project_id,
            "scope": scope,
            "kind": memory_kind,
            "source_session_id": source_session_id,
        },
    )
    return row


def search_memories(
    *,
    user_id: str,
    query: str,
    project_path: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return []

    project_id = project_id_from_path(project_path)
    hits: dict[str, dict[str, Any]] = {}

    for hit in vector_store.search_text(cleaned_query, limit=max(limit, 10)):
        payload = hit.get("payload") or {}
        if payload.get("type") != "agent_memory":
            continue
        if payload.get("user_id") not in {user_id, None}:
            continue
        memory_id = str(hit.get("id") or "")
        if not memory_id:
            continue
        hits[memory_id] = {
            "memory_id": memory_id,
            "content": str(payload.get("text") or ""),
            "scope": str(payload.get("scope") or "personal"),
            "kind": str(payload.get("kind") or "note"),
            "score": float(hit.get("score") or 0.0),
            "source": "vector",
        }

    for row in memory_store.search_memories_keyword(
        user_id,
        cleaned_query,
        project_id=project_id,
        limit=limit,
    ):
        memory_id = row["memory_id"]
        if memory_id in hits:
            continue
        hits[memory_id] = {
            "memory_id": memory_id,
            "content": row["content"],
            "scope": row["scope"],
            "kind": row["kind"],
            "score": 0.5,
            "source": "keyword",
        }

    ranked = sorted(hits.values(), key=lambda item: item["score"], reverse=True)
    return ranked[: max(1, min(limit, MAX_CONTEXT_ITEMS))]


def compose_memory_context(
    *,
    user_id: str,
    project_path: str | None,
    query: str,
) -> str:
    hits = search_memories(user_id=user_id, query=query, project_path=project_path, limit=MAX_CONTEXT_ITEMS)
    if not hits:
        return ""

    lines = ["Relevant memories from prior sessions:"]
    remaining = MAX_CONTEXT_CHARS
    for hit in hits:
        snippet = hit["content"][:160].strip()
        if not snippet:
            continue
        line = f"- [{hit['kind']}/{hit['scope']}] {snippet}"
        if len(line) > remaining:
            break
        lines.append(line)
        remaining -= len(line)

    if len(lines) <= 1:
        return ""
    return "\n".join(lines)


def extract_memories_from_summary(summary: str, *, max_items: int = 3) -> list[str]:
    candidates: list[str] = []
    for line in summary.splitlines():
        stripped = line.strip(" -•")
        if not stripped or len(stripped) < 24:
            continue
        if should_capture_signal(stripped):
            candidates.append(stripped[:300])
        if len(candidates) >= max_items:
            break
    return candidates


def capture_from_compact_summary(
    *,
    user_id: str,
    session_id: str,
    project_path: str,
    summary: str,
) -> list[str]:
    saved_ids: list[str] = []
    for fact in extract_memories_from_summary(summary):
        row = save_memory(
            user_id=user_id,
            content=fact,
            project_path=project_path,
            scope="team",
            source_session_id=session_id,
        )
        saved_ids.append(row["memory_id"])
    return saved_ids


def capture_from_proposal_decision(
    *,
    user_id: str,
    session_id: str,
    project_path: str | None,
    action: str,
    target_file: str,
    note: str | None,
) -> str | None:
    if action != "approve":
        return None
    pieces = [f"Approved change in {target_file}"]
    if note and note.strip():
        pieces.append(note.strip())
    content = ". ".join(pieces)
    if not should_capture_signal(content) and "architecture" not in content.lower():
        return None
    row = save_memory(
        user_id=user_id,
        content=content,
        project_path=project_path,
        scope="personal",
        kind="decision",
        source_session_id=session_id,
    )
    return row["memory_id"]


memory_service = type(
    "MemoryService",
    (),
    {
        "save_memory": staticmethod(save_memory),
        "search_memories": staticmethod(search_memories),
        "compose_memory_context": staticmethod(compose_memory_context),
        "capture_from_compact_summary": staticmethod(capture_from_compact_summary),
        "capture_from_proposal_decision": staticmethod(capture_from_proposal_decision),
        "project_id_from_path": staticmethod(project_id_from_path),
        "content_hash": staticmethod(content_hash),
    },
)()
