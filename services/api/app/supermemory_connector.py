from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import httpx

API_URL = os.getenv("SUPERMEMORY_API_URL", "https://api.supermemory.ai").rstrip("/")
_TAG_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{1,100}$")


def _load_project_config(project_path: str | None) -> dict[str, Any]:
    if not project_path:
        return {}
    config_path = Path(project_path).resolve() / ".codeforge" / "supermemory.json"
    if not config_path.is_file():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def resolve_api_key(project_path: str | None = None) -> str | None:
    project_cfg = _load_project_config(project_path)
    for candidate in (
        str(project_cfg.get("apiKey") or "").strip(),
        os.getenv("SUPERMEMORY_CC_API_KEY", "").strip(),
    ):
        if candidate:
            return candidate
    return None


def _default_personal_tag(user_id: str) -> str:
    return f"codeforge_user_{re.sub(r'[^a-zA-Z0-9._-]', '_', user_id)[:80]}"


def _default_repo_tag(project_path: str | None) -> str:
    if not project_path:
        return "codeforge_default"
    name = Path(project_path).resolve().name
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", name)[:80] or "codeforge_project"
    return f"codeforge_repo_{cleaned}"


def resolve_container_tags(
    *,
    user_id: str,
    project_path: str | None,
) -> tuple[str, str]:
    project_cfg = _load_project_config(project_path)
    personal = str(project_cfg.get("personalContainerTag") or "").strip() or _default_personal_tag(user_id)
    repo = str(project_cfg.get("repoContainerTag") or "").strip() or _default_repo_tag(project_path)
    return personal, repo


def is_configured(project_path: str | None = None) -> bool:
    return bool(resolve_api_key(project_path))


def get_status(*, user_id: str, project_path: str | None = None) -> dict[str, Any]:
    api_key = resolve_api_key(project_path)
    personal_tag, repo_tag = resolve_container_tags(user_id=user_id, project_path=project_path)
    project_cfg = _load_project_config(project_path)
    return {
        "configured": bool(api_key),
        "api_url": API_URL,
        "personal_container_tag": personal_tag,
        "repo_container_tag": repo_tag,
        "signal_extraction": bool(project_cfg.get("signalExtraction", False)),
        "requires_pro": True,
    }


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "x-sm-source": "codeforge",
    }


def search_memories(
    *,
    user_id: str,
    query: str,
    project_path: str | None = None,
    scope: str = "both",
    limit: int = 5,
) -> list[dict[str, Any]]:
    api_key = resolve_api_key(project_path)
    if not api_key or not query.strip():
        return []

    personal_tag, repo_tag = resolve_container_tags(user_id=user_id, project_path=project_path)
    tags: list[str] = []
    if scope in {"both", "personal", "user"}:
        tags.append(personal_tag)
    if scope in {"both", "team", "repo", "project"}:
        tags.append(repo_tag)

    results: list[dict[str, Any]] = []
    timeout = float(os.getenv("CODEFORGE_SYNTHESIS_TIMEOUT_SECONDS", "8"))
    with httpx.Client(timeout=timeout) as client:
        for tag in tags:
            try:
                response = client.post(
                    f"{API_URL}/v3/search",
                    headers=_headers(api_key),
                    json={
                        "q": query.strip(),
                        "containerTags": [tag],
                        "limit": max(1, min(limit, 10)),
                        "searchMode": "hybrid",
                    },
                )
            except httpx.HTTPError:
                continue
            if response.status_code >= 400:
                continue
            payload = response.json()
            for item in payload.get("results") or []:
                if isinstance(item, dict):
                    memory = item.get("content") or item.get("memory") or item.get("context") or ""
                    if memory:
                        results.append(
                            {
                                "memory": str(memory),
                                "container_tag": tag,
                                "similarity": float(item.get("similarity") or 0.0),
                                "metadata": item.get("metadata") or {},
                                "source": "supermemory",
                            }
                        )

    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in sorted(results, key=lambda row: row["similarity"], reverse=True):
        key = item["memory"].strip().lower()[:200]
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(item)
        if len(deduped) >= limit:
            break
    return deduped


def save_memory(
    *,
    user_id: str,
    content: str,
    project_path: str | None = None,
    scope: str = "personal",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    api_key = resolve_api_key(project_path)
    if not api_key:
        raise RuntimeError("Supermemory API key is not configured")
    cleaned = content.strip()
    if not cleaned:
        raise ValueError("Memory content cannot be empty")

    personal_tag, repo_tag = resolve_container_tags(user_id=user_id, project_path=project_path)
    container_tag = personal_tag if scope in {"personal", "user"} else repo_tag
    if container_tag and not _TAG_PATTERN.match(container_tag):
        container_tag = _default_repo_tag(project_path)

    payload = {
        "content": cleaned[:4000],
        "containerTag": container_tag,
        "metadata": {
            "sm_source": "codeforge",
            "user_id": user_id,
            **(metadata or {}),
        },
    }
    timeout = float(os.getenv("CODEFORGE_SYNTHESIS_TIMEOUT_SECONDS", "8"))
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            f"{API_URL}/v3/documents",
            headers=_headers(api_key),
            json=payload,
        )
    if response.status_code >= 400:
        raise RuntimeError(f"Supermemory save failed with status {response.status_code}")
    body = response.json()
    return {
        "id": body.get("id"),
        "status": body.get("status"),
        "container_tag": container_tag,
    }


def compose_supermemory_context(
    *,
    user_id: str,
    project_path: str | None,
    query: str,
) -> str:
    if not is_configured(project_path):
        return ""
    hits = search_memories(
        user_id=user_id,
        query=query,
        project_path=project_path,
        scope="both",
        limit=3,
    )
    if not hits:
        return ""
    lines = ["Supermemory (external):"]
    for hit in hits:
        lines.append(f"- {hit['memory'][:180]}")
    return "\n".join(lines)
