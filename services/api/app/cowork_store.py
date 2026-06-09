from __future__ import annotations

import json
from typing import Any

from .db import _execute, _fetchall, _fetchone


def _loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def _row_to_plan(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "plan_id": row["plan_id"],
        "user_id": row["user_id"],
        "session_id": row["session_id"],
        "project_path": row["project_path"],
        "title": row["title"],
        "task_type": row["task_type"],
        "command": row["command"],
        "source_path": row["source_path"],
        "url": row["url"],
        "browser_action": row["browser_action"],
        "connector_id": row["connector_id"],
        "tool_name": row["tool_name"],
        "connector_arguments": _loads(row.get("connector_arguments_json"), {}),
        "requires_approval": bool(row["requires_approval"]),
        "preview_steps": _loads(row.get("preview_steps_json"), []),
        "status": row["status"],
        "created_at": row["created_at"],
    }


def _row_to_run(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "run_id": row["run_id"],
        "plan_id": row["plan_id"],
        "user_id": row["user_id"],
        "task_type": row["task_type"],
        "status": row["status"],
        "summary": row["summary"],
        "details": _loads(row.get("details_json"), {}),
        "trigger": row["trigger_type"],
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
    }


def _row_to_job(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "job_id": row["job_id"],
        "user_id": row["user_id"],
        "session_id": row["session_id"],
        "project_path": row["project_path"],
        "title": row["title"],
        "trigger_type": row["trigger_type"],
        "interval_seconds": row["interval_seconds"],
        "watch_path": row["watch_path"],
        "watch_absolute": row["watch_absolute"],
        "watch_mtime": row["watch_mtime"],
        "task_type": row["task_type"],
        "command": row["command"],
        "source_path": row["source_path"],
        "url": row["url"],
        "browser_action": row["browser_action"],
        "enabled": bool(row["enabled"]),
        "consecutive_failures": row["consecutive_failures"],
        "circuit_broken": bool(row["circuit_broken"]),
        "circuit_broken_reason": row["circuit_broken_reason"] or "",
        "next_run_at": row["next_run_at"],
        "last_run_at": row["last_run_at"],
        "last_status": row["last_status"],
        "created_at": row["created_at"],
    }


def _row_to_extraction(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "extraction_id": row["extraction_id"],
        "user_id": row["user_id"],
        "source_path": row["source_path"],
        "method": row["method"],
        "byte_size": row["byte_size"],
        "text_excerpt": row["text_excerpt"],
        "entities": _loads(row.get("entities_json"), []),
        "warnings": _loads(row.get("warnings_json"), []),
        "created_at": row["created_at"],
    }


def save_plan(plan: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO cowork_plans(
            plan_id, user_id, session_id, project_path, title, task_type, command, source_path,
            url, browser_action, connector_id, tool_name, connector_arguments_json,
            requires_approval, preview_steps_json, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            plan["plan_id"],
            plan["user_id"],
            plan["session_id"],
            plan["project_path"],
            plan["title"],
            plan["task_type"],
            plan.get("command"),
            plan.get("source_path"),
            plan.get("url"),
            plan.get("browser_action"),
            plan.get("connector_id"),
            plan.get("tool_name"),
            _dumps(plan.get("connector_arguments") or {}),
            1 if plan.get("requires_approval") else 0,
            _dumps(plan.get("preview_steps") or []),
            plan["status"],
            plan["created_at"],
        ),
    )


def get_plan(plan_id: str) -> dict[str, Any] | None:
    row = _fetchone("SELECT * FROM cowork_plans WHERE plan_id = ?", (plan_id,))
    return _row_to_plan(row) if row else None


def list_plans(user_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        "SELECT * FROM cowork_plans WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    )
    return [_row_to_plan(row) for row in rows]


def update_plan_status(plan_id: str, status: str) -> None:
    _execute("UPDATE cowork_plans SET status = ? WHERE plan_id = ?", (status, plan_id))


def save_run(run: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO cowork_runs(
            run_id, plan_id, user_id, task_type, status, summary, details_json,
            trigger_type, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            run["run_id"],
            run["plan_id"],
            run["user_id"],
            run["task_type"],
            run["status"],
            run["summary"],
            _dumps(run.get("details") or {}),
            run["trigger"],
            run["created_at"],
            run.get("completed_at"),
        ),
    )


def update_run(run_id: str, *, status: str, summary: str, details: dict[str, Any], completed_at: str) -> None:
    _execute(
        """
        UPDATE cowork_runs
        SET status = ?, summary = ?, details_json = ?, completed_at = ?
        WHERE run_id = ?
        """,
        (status, summary, _dumps(details), completed_at, run_id),
    )


def list_runs(user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT * FROM cowork_runs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (user_id, limit),
    )
    return [_row_to_run(row) for row in rows]


def list_recent_runs(limit: int = 50) -> list[dict[str, Any]]:
    rows = _fetchall(
        "SELECT * FROM cowork_runs ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )
    return [_row_to_run(row) for row in rows]


def count_running_runs() -> int:
    row = _fetchone("SELECT COUNT(*) AS count FROM cowork_runs WHERE status = 'running'")
    return int(row["count"]) if row else 0


def save_job(job: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO cowork_jobs(
            job_id, user_id, session_id, project_path, title, trigger_type, interval_seconds,
            watch_path, watch_absolute, watch_mtime, task_type, command, source_path, url,
            browser_action, enabled, consecutive_failures, circuit_broken, circuit_broken_reason,
            next_run_at, last_run_at, last_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            job["job_id"],
            job["user_id"],
            job["session_id"],
            job["project_path"],
            job["title"],
            job["trigger_type"],
            job["interval_seconds"],
            job.get("watch_path"),
            job.get("watch_absolute"),
            job.get("watch_mtime"),
            job["task_type"],
            job.get("command"),
            job.get("source_path"),
            job.get("url"),
            job.get("browser_action"),
            1 if job.get("enabled") else 0,
            int(job.get("consecutive_failures", 0)),
            1 if job.get("circuit_broken") else 0,
            job.get("circuit_broken_reason") or "",
            job.get("next_run_at"),
            job.get("last_run_at"),
            job.get("last_status"),
            job["created_at"],
        ),
    )


def get_job(job_id: str) -> dict[str, Any] | None:
    row = _fetchone("SELECT * FROM cowork_jobs WHERE job_id = ?", (job_id,))
    return _row_to_job(row) if row else None


def list_jobs(user_id: str) -> list[dict[str, Any]]:
    rows = _fetchall(
        "SELECT * FROM cowork_jobs WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    )
    return [_row_to_job(row) for row in rows]


def list_enabled_jobs() -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT * FROM cowork_jobs
        WHERE enabled = 1 AND circuit_broken = 0
        ORDER BY created_at ASC
        """,
    )
    return [_row_to_job(row) for row in rows]


def update_job(job_id: str, job: dict[str, Any]) -> None:
    _execute(
        """
        UPDATE cowork_jobs
        SET enabled = ?, consecutive_failures = ?, circuit_broken = ?, circuit_broken_reason = ?,
            next_run_at = ?, last_run_at = ?, last_status = ?, watch_mtime = ?
        WHERE job_id = ?
        """,
        (
            1 if job.get("enabled") else 0,
            int(job.get("consecutive_failures", 0)),
            1 if job.get("circuit_broken") else 0,
            job.get("circuit_broken_reason") or "",
            job.get("next_run_at"),
            job.get("last_run_at"),
            job.get("last_status"),
            job.get("watch_mtime"),
            job_id,
        ),
    )


def count_jobs() -> tuple[int, int, int]:
    total = _fetchone("SELECT COUNT(*) AS count FROM cowork_jobs")
    enabled = _fetchone("SELECT COUNT(*) AS count FROM cowork_jobs WHERE enabled = 1")
    broken = _fetchone("SELECT COUNT(*) AS count FROM cowork_jobs WHERE circuit_broken = 1")
    return (
        int(total["count"]) if total else 0,
        int(enabled["count"]) if enabled else 0,
        int(broken["count"]) if broken else 0,
    )


def save_extraction(extraction: dict[str, Any]) -> None:
    _execute(
        """
        INSERT INTO cowork_extractions(
            extraction_id, user_id, source_path, method, byte_size, text_excerpt,
            entities_json, warnings_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            extraction["extraction_id"],
            extraction["user_id"],
            extraction["source_path"],
            extraction["method"],
            extraction.get("byte_size", 0),
            extraction.get("text_excerpt", ""),
            _dumps(extraction.get("entities") or []),
            _dumps(extraction.get("warnings") or []),
            extraction["created_at"],
        ),
    )


def list_extractions(user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    rows = _fetchall(
        """
        SELECT * FROM cowork_extractions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (user_id, limit),
    )
    return [_row_to_extraction(row) for row in rows]
