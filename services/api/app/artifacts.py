from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from . import artifact_store


_ARTIFACT_FENCE_RE = re.compile(
    r"```(html|markdown|md|mermaid|svg|jsx|tsx|react)\s*\n(.*?)```",
    re.DOTALL | re.IGNORECASE,
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _title_for_kind(kind: str, index: int) -> str:
    return f"{kind.title()} artifact {index}"


def extract_artifacts_from_text(
    *,
    text: str,
    session_id: str,
    user_id: str,
    source_message_id: str | None = None,
) -> list[dict[str, Any]]:
    saved: list[dict[str, Any]] = []
    for index, match in enumerate(_ARTIFACT_FENCE_RE.finditer(text), start=1):
        raw_kind = match.group(1).lower()
        kind = "markdown" if raw_kind == "md" else raw_kind
        if kind == "react":
            kind = "jsx"
        content = match.group(2).strip()
        if not content:
            continue

        artifact = {
            "artifact_id": f"art_{uuid4().hex[:10]}",
            "session_id": session_id,
            "user_id": user_id,
            "title": _title_for_kind(kind, index),
            "kind": kind,
            "content": content,
            "source_message_id": source_message_id,
            "created_at": _utc_now(),
        }
        artifact_store.save_artifact(artifact)
        saved.append(artifact)
    return saved


def list_session_artifacts(*, session_id: str, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    return artifact_store.list_artifacts_for_session(session_id, user_id, limit=limit)


def get_session_artifact(*, artifact_id: str, user_id: str) -> dict[str, Any] | None:
    return artifact_store.get_artifact(artifact_id, user_id)


def render_artifact_preview(artifact: dict[str, Any]) -> str:
    kind = str(artifact.get("kind", "markdown")).lower()
    content = str(artifact.get("content", ""))
    title = str(artifact.get("title", "Artifact"))

    if kind == "html":
        return content

    if kind in {"jsx", "tsx"}:
        escaped = content.replace("</script>", "<\\/script>")
        return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js"></script>
    <style>body {{ font-family: system-ui, sans-serif; margin: 1rem; }}</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel">
{escaped}
    </script>
  </body>
</html>"""

    if kind == "svg":
        if content.strip().startswith("<svg"):
            return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>{title}</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b1220">
{content}
</body></html>"""

    if kind == "mermaid":
        return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  </head>
  <body>
    <pre class="mermaid">{content}</pre>
    <script>mermaid.initialize({{ startOnLoad: true, theme: "dark" }});</script>
  </body>
</html>"""

    escaped = (
        content.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>{title}</title>
    <style>
      body {{ font-family: ui-sans-serif, system-ui, sans-serif; margin: 1rem; line-height: 1.5; }}
      pre {{ white-space: pre-wrap; }}
    </style>
  </head>
  <body>
    <h1>{title}</h1>
    <pre>{escaped}</pre>
  </body>
</html>"""
