from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .cowork import CoworkError, _normalize_within_project, extract_structured_data


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _collect_sources(project_path: str, source_path: str, *, limit: int = 20) -> list[dict[str, Any]]:
    resolved = _normalize_within_project(project_path, source_path)
    root = Path(project_path).expanduser().resolve()
    sources: list[dict[str, Any]] = []

    if resolved.is_file():
        payload = extract_structured_data(project_path, resolved.relative_to(root).as_posix())
        sources.append(payload)
        return sources

    for item in sorted(resolved.rglob("*")):
        if not item.is_file() or item.name.startswith("."):
            continue
        rel = item.relative_to(root).as_posix()
        try:
            sources.append(extract_structured_data(project_path, rel))
        except CoworkError:
            continue
        if len(sources) >= limit:
            break
    return sources


def synthesize_markdown_report(
    *,
    project_path: str,
    source_path: str,
    output_name: str = "cowork-report.md",
    title: str = "CodeForge Cowork Report",
    prompt: str = "",
) -> dict[str, Any]:
    sources = _collect_sources(project_path, source_path)
    if not sources:
        raise CoworkError("No readable sources found for synthesis")

    lines = [
        f"# {title}",
        "",
        f"Generated: {_utc_now_iso()}",
        "",
    ]
    if prompt.strip():
        lines.extend([f"**Goal:** {prompt.strip()}", ""])

    lines.append(f"**Sources analyzed:** {len(sources)}")
    lines.append("")

    for index, source in enumerate(sources, start=1):
        rel = Path(source["source_path"]).name
        lines.append(f"## {index}. {rel}")
        lines.append("")
        excerpt = str(source.get("text_excerpt") or "").strip()
        if excerpt:
            lines.append(excerpt[:1800])
            lines.append("")
        entities = source.get("entities") or []
        if entities:
            lines.append("**Entities:**")
            for entity in entities[:12]:
                if entity.get("type") == "key_value":
                    lines.append(f"- {entity.get('key')}: {entity.get('value')}")
                else:
                    lines.append(f"- {entity.get('type')}: {entity.get('value')}")
            lines.append("")

    output_rel = output_name.strip() or "cowork-report.md"
    if "/" not in output_rel:
        output_rel = f".codeforge/cowork/reports/{output_rel}"
    output_path = (Path(project_path).expanduser().resolve() / output_rel).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(lines).strip() + "\n"
    output_path.write_text(content, encoding="utf-8")

    return {
        "status": "completed",
        "summary": f"Synthesized markdown report from {len(sources)} source(s)",
        "output_path": output_path.relative_to(Path(project_path).resolve()).as_posix(),
        "source_count": len(sources),
        "format": "markdown",
        "byte_size": len(content.encode("utf-8")),
    }


def synthesize_csv_entities(
    *,
    project_path: str,
    source_path: str,
    output_name: str = "cowork-entities.csv",
) -> dict[str, Any]:
    sources = _collect_sources(project_path, source_path)
    rows: list[dict[str, str]] = []
    for source in sources:
        rel = Path(source["source_path"]).name
        for entity in source.get("entities") or []:
            rows.append(
                {
                    "source_file": rel,
                    "entity_type": str(entity.get("type", "")),
                    "key": str(entity.get("key", "")),
                    "value": str(entity.get("value", "")),
                }
            )

    output_rel = output_name.strip() or "cowork-entities.csv"
    if "/" not in output_rel:
        output_rel = f".codeforge/cowork/reports/{output_rel}"
    output_path = (Path(project_path).expanduser().resolve() / output_rel).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source_file", "entity_type", "key", "value"])
        writer.writeheader()
        writer.writerows(rows)

    return {
        "status": "completed",
        "summary": f"Exported {len(rows)} entities to CSV",
        "output_path": output_path.relative_to(Path(project_path).resolve()).as_posix(),
        "entity_count": len(rows),
        "format": "csv",
    }
