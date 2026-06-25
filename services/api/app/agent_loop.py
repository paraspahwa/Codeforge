from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from .agent import build_agent_run
from .db import insert_agent_proposal, update_agent_proposal_status
from .file_ops import apply_proposed_content
from .loop_engineering import VerifyCommand
from .models import utc_now
from .shell_ops import ShellError, run_shell_command


@dataclass(frozen=True)
class VerifyStep:
    command: str
    cwd: str = "."


@dataclass
class AgentLoopAttemptResult:
    attempt: int
    verify_passed: bool
    verify_exit_code: int
    verify_summary: str
    proposal_id: str | None
    applied: bool
    target_file: str | None
    patch_source: str | None


@dataclass
class AgentLoopResult:
    session_id: str
    passed: bool
    attempts: list[AgentLoopAttemptResult]
    message: str
    verify_commands: list[str] | None = None


def verify_commands_to_steps(commands: list[VerifyCommand]) -> list[VerifyStep]:
    steps: list[VerifyStep] = []
    for item in commands:
        if item.required:
            steps.append(VerifyStep(command=item.command, cwd=item.cwd))
    return steps


async def _run_verify_steps(
    project_path: str,
    steps: list[VerifyStep],
    *,
    user_id: str,
) -> dict[str, Any]:
    if not steps:
        return {
            "exit_code": 1,
            "summary": "No verify commands configured",
            "passed": False,
        }

    summaries: list[str] = []
    for step in steps:
        label = f"[{step.cwd}] {step.command}" if step.cwd not in {".", "./"} else step.command
        try:
            verify = await run_shell_command(
                project_path,
                step.command,
                user_id=user_id,
                working_dir=None if step.cwd in {".", "./"} else step.cwd,
            )
        except ShellError as exc:
            verify = {
                "exit_code": 1,
                "summary": str(exc),
                "passed": False,
            }

        summaries.append(f"$ {label}\n{verify.get('summary', '')}")
        if not verify.get("passed"):
            return {
                "exit_code": int(verify.get("exit_code", 1)),
                "summary": "\n\n".join(summaries),
                "passed": False,
            }

    return {
        "exit_code": 0,
        "summary": "\n\n".join(summaries),
        "passed": True,
    }


async def run_verify_fix_loop(
    *,
    session_id: str,
    user_id: str,
    project_path: str,
    verify_command: str | None = None,
    verify_steps: list[VerifyStep] | None = None,
    fix_prompt: str | None = None,
    max_attempts: int = 5,
    auto_apply: bool = True,
    auto_mode: bool = False,
    current_file: str | None = None,
) -> AgentLoopResult:
    if verify_steps:
        steps = verify_steps
        verify_label = " → ".join(step.command for step in steps)
    elif verify_command:
        steps = [VerifyStep(command=verify_command)]
        verify_label = verify_command
    else:
        raise ValueError("verify_command or verify_steps is required")

    prompt_seed = fix_prompt or "Fix the failing verification command with minimal, safe changes."
    attempts: list[AgentLoopAttemptResult] = []

    for attempt in range(1, max_attempts + 1):
        verify = await _run_verify_steps(project_path, steps, user_id=user_id)

        if verify.get("passed"):
            return AgentLoopResult(
                session_id=session_id,
                passed=True,
                attempts=attempts,
                message=f"Verification passed on attempt {attempt}.",
                verify_commands=[step.command for step in steps],
            )

        loop_prompt = (
            f"{prompt_seed}\n\n"
            f"Verification command(s): {verify_label}\n"
            f"Attempt: {attempt}/{max_attempts}\n"
            f"Latest verify output:\n{verify.get('summary', '')}"
        )

        run = await build_agent_run(
            prompt=loop_prompt,
            session_id=session_id,
            project_path=project_path,
            current_file=current_file,
        )

        proposal_id: str | None = None
        applied = False
        patch_source: str | None = None

        if run.proposed_content != run.original_content and run.target_file:
            proposal_id = f"prop_{uuid4().hex[:12]}"
            insert_agent_proposal(
                proposal_id=proposal_id,
                session_id=session_id,
                user_id=user_id,
                target_file=run.target_file,
                prompt=loop_prompt,
                original_content=run.original_content,
                proposed_content=run.proposed_content,
                patch_preview=run.patch_preview,
                status="pending",
                created_at=utc_now().isoformat(),
            )

            patch_source = next(
                (
                    str(event.payload.get("source"))
                    for event in run.events
                    if event.type == "tool_result" and event.payload.get("tool") == "file.patch"
                ),
                None,
            )

            if auto_apply and (not auto_mode or not run.review_required):
                applied = apply_proposed_content(project_path, run.target_file, run.proposed_content)
                if applied:
                    update_agent_proposal_status(
                        proposal_id=proposal_id,
                        status="approved",
                        resolved_at=utc_now().isoformat(),
                        resolution_note="Auto-applied by agent loop",
                    )

        attempts.append(
            AgentLoopAttemptResult(
                attempt=attempt,
                verify_passed=False,
                verify_exit_code=int(verify.get("exit_code", 1)),
                verify_summary=str(verify.get("summary", "")),
                proposal_id=proposal_id,
                applied=applied,
                target_file=run.target_file,
                patch_source=patch_source,
            )
        )

    return AgentLoopResult(
        session_id=session_id,
        passed=False,
        attempts=attempts,
        message=f"Verification did not pass within {max_attempts} attempt(s).",
        verify_commands=[step.command for step in steps],
    )


def serialize_loop_result(result: AgentLoopResult) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "session_id": result.session_id,
        "passed": result.passed,
        "message": result.message,
        "attempts": [
            {
                "attempt": item.attempt,
                "verify_passed": item.verify_passed,
                "verify_exit_code": item.verify_exit_code,
                "verify_summary": item.verify_summary,
                "proposal_id": item.proposal_id,
                "applied": item.applied,
                "target_file": item.target_file,
                "patch_source": item.patch_source,
            }
            for item in result.attempts
        ],
    }
    if result.verify_commands:
        payload["verify_commands"] = result.verify_commands
    return payload
