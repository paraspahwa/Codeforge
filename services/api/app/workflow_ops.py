from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from .agent import build_agent_run
from .db import (
    get_session_file_plan,
    insert_agent_proposal,
    insert_session_file_plan,
    list_agent_proposals_for_session,
    list_messages_for_session,
    update_agent_proposal_status,
    update_session_file_plan_status,
)
from .file_ops import apply_proposed_content, read_file_content, repo_relative_path
from .git_ops import GitError, git_status
from .models import utc_now


@dataclass
class UltrareviewFinding:
    severity: str
    message: str


def _clip(text: str, limit: int = 180) -> str:
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1]}…"


def capture_file_snapshot(project_path: str, targets: list[str]) -> dict[str, str]:
    snapshot: dict[str, str] = {}
    for target in targets:
        relative = repo_relative_path(project_path, target)
        if not relative:
            continue
        snapshot[relative] = read_file_content(project_path, relative)
    return snapshot


def restore_file_snapshot(project_path: str, snapshot: dict[str, str]) -> list[str]:
    restored: list[str] = []
    for relative_path, content in snapshot.items():
        if apply_proposed_content(project_path, relative_path, content):
            restored.append(relative_path)
    return restored


async def build_compact_summary_llm(
    *,
    session_id: str,
    project_path: str,
    user_id: str,
    message_limit: int = 12,
) -> dict[str, Any]:
    base = build_compact_summary(
        session_id=session_id,
        project_path=project_path,
        user_id=user_id,
        message_limit=message_limit,
    )
    from .agent import generation_client

    response = await generation_client.generate(
        prompt=(
            "Summarize this coding session for continuation. Keep objectives, decisions, and next steps.\n\n"
            f"{base['summary']}"
        ),
        system_prompt="You compress chat context for a coding agent. Output plain text under 250 words.",
        max_tokens=500,
    )
    text = str(response.get("text", "")).strip()
    if text and not text.startswith("Deterministic fallback"):
        base["summary"] = text
        base["engine"] = "llm"
    else:
        base["engine"] = "heuristic"
    return base


def build_compact_summary(
    *,
    session_id: str,
    project_path: str,
    user_id: str,
    message_limit: int = 12,
) -> dict[str, Any]:
    messages = list_messages_for_session(session_id, limit=message_limit)
    proposals = list_agent_proposals_for_session(session_id, user_id, limit=10)

    try:
        git = git_status(project_path)
        git_line = f"{git['branch']} | {git['summary']}"
    except GitError:
        git_line = "git status unavailable"

    recent_messages = [
        f"- {row['role']}: {_clip(str(row['content']), 120)}"
        for row in messages[-6:]
    ]
    recent_proposals = [
        f"- {row['target_file']} ({row['status']})"
        for row in proposals[:5]
    ]

    summary_lines = [
        f"Session: {session_id}",
        f"Project: {project_path}",
        f"Git: {git_line}",
        f"Messages: {len(messages)}",
        f"Proposals: {len(proposals)}",
        "",
        "Recent messages:",
        *(recent_messages or ["- none"]),
        "",
        "Recent proposals:",
        *(recent_proposals or ["- none"]),
        "",
        "Continuation prompt:",
        "Resume from the latest user intent, keep edits minimal, and verify before apply.",
    ]

    return {
        "session_id": session_id,
        "summary": "\n".join(summary_lines),
        "message_count": len(messages),
        "proposal_count": len(proposals),
    }


def build_ultrareview_audit(
    *,
    session_id: str,
    project_path: str,
    user_id: str,
    target_file: str | None = None,
) -> dict[str, Any]:
    findings: list[UltrareviewFinding] = []
    proposals = list_agent_proposals_for_session(session_id, user_id, limit=20)
    pending = [row for row in proposals if row["status"] == "pending"]

    if not proposals:
        findings.append(UltrareviewFinding("medium", "No proposals recorded for this session yet."))

    if pending:
        findings.append(
            UltrareviewFinding(
                "high",
                f"{len(pending)} pending proposal(s) require review before apply.",
            ),
        )

    try:
        git = git_status(project_path)
        if not git["clean"]:
            findings.append(
                UltrareviewFinding(
                    "medium",
                    f"Working tree is dirty on branch {git['branch']} ({len(git['changed_files'])} changed files).",
                ),
            )
    except GitError as exc:
        findings.append(UltrareviewFinding("low", f"Git inspection failed: {exc}"))

    if target_file:
        content = read_file_content(project_path, target_file)
        if not content.strip():
            findings.append(UltrareviewFinding("medium", f"Target file {target_file} is empty or missing."))
        if "TODO" in content or "FIXME" in content:
            findings.append(UltrareviewFinding("low", f"Target file {target_file} contains TODO/FIXME markers."))

    risk_level = "low"
    if any(item.severity == "high" for item in findings):
        risk_level = "high"
    elif any(item.severity == "medium" for item in findings):
        risk_level = "medium"

    suggested_checks = [
        "Review pending proposals and git diff before applying changes.",
        "Run the relevant test or lint command after edits.",
        "Confirm rollback plan exists for grouped multi-file work.",
    ]

    finding_lines = (
        [f"- [{item.severity}] {item.message}" for item in findings]
        or ["- No obvious issues detected from current session state."]
    )

    report_lines = [
        f"Ultrareview for session {session_id}",
        f"Project: {project_path}",
        f"Risk level: {risk_level}",
        "",
        "Findings:",
        *finding_lines,
        "",
        "Suggested checks:",
        *(f"- {item}" for item in suggested_checks),
    ]

    return {
        "session_id": session_id,
        "risk_level": risk_level,
        "findings": [{"severity": item.severity, "message": item.message} for item in findings],
        "suggested_checks": suggested_checks,
        "report": "\n".join(report_lines),
    }


def create_multi_file_plan(
    *,
    session_id: str,
    user_id: str,
    project_path: str,
    targets: list[str],
) -> dict[str, Any]:
    normalized = []
    for target in targets:
        relative = repo_relative_path(project_path, target)
        if relative and relative not in normalized:
            normalized.append(relative)

    if not normalized:
        raise ValueError("No valid target files inside the project")

    plan_id = f"plan_{uuid4().hex[:12]}"
    snapshot = capture_file_snapshot(project_path, normalized)
    created_at = utc_now().isoformat()

    insert_session_file_plan(
        plan_id=plan_id,
        session_id=session_id,
        user_id=user_id,
        targets_json=json.dumps(normalized),
        snapshot_json=json.dumps(snapshot),
        status="ready",
        created_at=created_at,
    )

    return {
        "plan_id": plan_id,
        "session_id": session_id,
        "targets": normalized,
        "status": "ready",
        "created_at": created_at,
    }


async def execute_multi_file_plan(
    *,
    plan_id: str,
    session_id: str,
    user_id: str,
    project_path: str,
    prompt: str | None = None,
    auto_mode: bool = False,
) -> dict[str, Any]:
    plan = get_session_file_plan(plan_id=plan_id, session_id=session_id, user_id=user_id)
    if plan is None:
        raise ValueError("Plan not found")

    targets = json.loads(plan["targets_json"])
    snapshot = json.loads(plan["snapshot_json"])
    plan_prompt = prompt or "Apply the requested grouped update safely across all target files."

    applied_items: list[dict[str, Any]] = []

    try:
        for target in targets:
            run = await build_agent_run(
                prompt=f"{plan_prompt}\n\nTarget file: {target}\nKeep the change focused on this file.",
                session_id=session_id,
                project_path=project_path,
                current_file=target,
            )

            proposal_id: str | None = None
            applied = False

            if run.proposed_content != run.original_content:
                proposal_id = f"prop_{uuid4().hex[:12]}"
                insert_agent_proposal(
                    proposal_id=proposal_id,
                    session_id=session_id,
                    user_id=user_id,
                    target_file=run.target_file,
                    prompt=plan_prompt,
                    original_content=run.original_content,
                    proposed_content=run.proposed_content,
                    patch_preview=run.patch_preview,
                    status="pending",
                    created_at=utc_now().isoformat(),
                )

                can_auto_apply = not auto_mode or not run.review_required
                if can_auto_apply:
                    applied = apply_proposed_content(project_path, run.target_file, run.proposed_content)
                    if applied:
                        update_agent_proposal_status(
                            proposal_id=proposal_id,
                            status="approved",
                            resolved_at=utc_now().isoformat(),
                            resolution_note="Auto-applied by multi-file plan",
                        )
                elif auto_mode and run.review_required:
                    raise ValueError(
                        f"Auto mode blocked apply for {target} due to review_required ({run.confidence_label})",
                    )
            else:
                raise ValueError(f"No applicable change produced for {target}")

            applied_items.append(
                {
                    "target": target,
                    "proposal_id": proposal_id,
                    "applied": applied,
                    "review_required": run.review_required,
                    "confidence_label": run.confidence_label,
                },
            )

        update_session_file_plan_status(plan_id=plan_id, status="applied", executed_at=utc_now().isoformat())
        return {
            "plan_id": plan_id,
            "status": "applied",
            "applied": applied_items,
            "message": f"Plan {plan_id} applied to {len(applied_items)} file(s).",
            "rolled_back_paths": [],
        }
    except Exception as exc:
        restored = restore_file_snapshot(project_path, snapshot)
        update_session_file_plan_status(
            plan_id=plan_id,
            status="rolled_back",
            executed_at=utc_now().isoformat(),
        )
        return {
            "plan_id": plan_id,
            "status": "rolled_back",
            "applied": applied_items,
            "message": f"Plan {plan_id} rolled back after failure: {exc}",
            "rolled_back_paths": restored,
        }


def rollback_multi_file_plan(
    *,
    plan_id: str,
    session_id: str,
    user_id: str,
    project_path: str,
) -> dict[str, Any]:
    plan = get_session_file_plan(plan_id=plan_id, session_id=session_id, user_id=user_id)
    if plan is None:
        raise ValueError("Plan not found")

    snapshot = json.loads(plan["snapshot_json"])
    restored = restore_file_snapshot(project_path, snapshot)
    update_session_file_plan_status(plan_id=plan_id, status="restored", executed_at=utc_now().isoformat())

    return {
        "plan_id": plan_id,
        "restored_paths": restored,
        "message": f"Restored {len(restored)} file(s) from plan {plan_id}.",
    }
