from __future__ import annotations

import json
from typing import Any

from .db import insert_session_checkpoint, list_session_checkpoints, get_session_checkpoint
from .workflow_ops import capture_file_snapshot, restore_file_snapshot


def checkpoints_enabled() -> bool:
    import os

    return os.getenv("CODEFORGE_CHECKPOINTS_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}


def save_checkpoint(
    *,
    checkpoint_id: str,
    session_id: str,
    user_id: str,
    project_path: str,
    snapshot: dict[str, str],
    label: str,
    message_index: int | None = None,
    git_sha: str | None = None,
) -> dict[str, Any]:
    insert_session_checkpoint(
        checkpoint_id=checkpoint_id,
        session_id=session_id,
        user_id=user_id,
        project_path=project_path,
        label=label,
        snapshot_json=json.dumps(snapshot),
        message_index=message_index,
        git_sha=git_sha,
    )
    return {"checkpoint_id": checkpoint_id, "label": label, "files": list(snapshot.keys())}


def rewind_checkpoint(
    *,
    checkpoint_id: str,
    session_id: str,
    user_id: str,
    project_path: str,
) -> dict[str, Any]:
    row = get_session_checkpoint(checkpoint_id=checkpoint_id, session_id=session_id, user_id=user_id)
    if row is None:
        raise ValueError("Checkpoint not found")
    snapshot = json.loads(row["snapshot_json"])
    restored = restore_file_snapshot(project_path, snapshot)
    return {"checkpoint_id": checkpoint_id, "restored_paths": restored, "label": row["label"]}


def list_checkpoints(session_id: str, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    return list_session_checkpoints(session_id=session_id, user_id=user_id, limit=limit)


def create_pre_write_checkpoint(
    *,
    session_id: str,
    user_id: str,
    project_path: str,
    targets: list[str],
    label: str = "auto",
) -> str | None:
    if not checkpoints_enabled() or not targets:
        return None
    from uuid import uuid4

    checkpoint_id = f"chk_{uuid4().hex[:12]}"
    snapshot = capture_file_snapshot(project_path, targets)
    save_checkpoint(
        checkpoint_id=checkpoint_id,
        session_id=session_id,
        user_id=user_id,
        project_path=project_path,
        snapshot=snapshot,
        label=label,
    )
    return checkpoint_id
