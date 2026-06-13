from __future__ import annotations

from typing import Any

from .cowork import CoworkError, cowork_service
from .cowork_file_ops import execute_file_operations
from .cowork_planner import plan_from_goal
from .cowork_synthesis import synthesize_csv_entities, synthesize_markdown_report


async def execute_workflow_step(
    *,
    step: dict[str, Any],
    user_id: str,
    session_id: str,
    project_path: str,
    approved: bool,
) -> dict[str, Any]:
    task_type = str(step.get("task_type", ""))

    if task_type == "file_ops":
        if step.get("requires_approval", True) and not approved:
            raise CoworkError("File operations require approval before execution")
        operations = list(step.get("operations") or [])
        details = execute_file_operations(project_path, operations)
        return {"step_id": step.get("step_id"), "task_type": task_type, **details}

    if task_type == "synthesize":
        if str(step.get("format", "markdown")).lower() == "csv":
            details = synthesize_csv_entities(
                project_path=project_path,
                source_path=str(step.get("source_path") or "."),
                output_name=str(step.get("output_name") or "cowork-entities.csv"),
            )
        else:
            details = synthesize_markdown_report(
                project_path=project_path,
                source_path=str(step.get("source_path") or "."),
                output_name=str(step.get("output_name") or "cowork-report.md"),
                title=str(step.get("title") or "CodeForge Cowork Report"),
                prompt=str(step.get("prompt") or ""),
            )
        return {"step_id": step.get("step_id"), "task_type": task_type, **details}

    plan = cowork_service.create_plan(
        user_id=user_id,
        session_id=session_id,
        project_path=project_path,
        title=str(step.get("title") or f"Cowork {task_type}"),
        task_type=task_type,
        command=step.get("command"),
        source_path=step.get("source_path"),
        url=step.get("url"),
        browser_action=step.get("browser_action"),
        connector_id=step.get("connector_id"),
        tool_name=step.get("tool_name"),
        connector_arguments=step.get("connector_arguments"),
        scrape_prompt=step.get("scrape_prompt"),
    )
    step_approved = approved or not plan.get("requires_approval")
    run = await cowork_service.run_plan(
        user_id=user_id,
        plan_id=plan["plan_id"],
        approved=step_approved,
        trigger="workflow",
    )
    return {
        "step_id": step.get("step_id"),
        "task_type": task_type,
        "plan_id": plan["plan_id"],
        "run_id": run["run_id"],
        "status": run["status"],
        "summary": run["summary"],
        "details": run.get("details") or {},
    }


async def run_goal_workflow(
    *,
    goal: str,
    user_id: str,
    session_id: str,
    project_path: str,
    approved: bool,
) -> dict[str, Any]:
    workflow = plan_from_goal(goal, project_path=project_path, session_id=session_id)
    if workflow.get("requires_approval") and not approved:
        raise CoworkError("This Cowork workflow requires explicit approval before execution")

    step_results: list[dict[str, Any]] = []
    for step in workflow.get("steps", []):
        result = await execute_workflow_step(
            step=step,
            user_id=user_id,
            session_id=session_id,
            project_path=project_path,
            approved=approved,
        )
        step_results.append(result)
        if str(result.get("status", "")).lower() not in {"completed", "partial"}:
            break

    completed = sum(1 for item in step_results if str(item.get("status", "")).lower() in {"completed", "partial"})
    overall_status = "completed" if completed == len(step_results) else "partial" if completed else "failed"

    return {
        "workflow_id": workflow["workflow_id"],
        "goal": workflow["goal"],
        "status": overall_status,
        "summary": f"Cowork completed {completed}/{len(workflow['steps'])} step(s)",
        "step_results": step_results,
        "preview_lines": workflow.get("preview_lines") or [],
    }
