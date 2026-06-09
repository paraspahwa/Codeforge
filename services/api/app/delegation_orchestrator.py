from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from .agent import build_agent_run
from .agent_templates import agent_template_service
from .projects_team import ProjectsTeamError


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_agent_roles(assigned_role: str, agent_roles: list[str] | None = None) -> list[str]:
    if agent_roles:
        return [role.strip() for role in agent_roles if role.strip()]
    if "," in assigned_role:
        return [part.strip() for part in assigned_role.split(",") if part.strip()]
    return [assigned_role.strip()] if assigned_role.strip() else ["agent"]


def _role_prompt_prefix(actor_id: str, role: str) -> str:
    templates = agent_template_service.list_templates(user_id=actor_id)
    match = next((item for item in templates if item["name"].lower() == role.lower()), None)
    if match:
        return str(match["prompt_prefix"])
    return f"You are acting as the team role '{role}'. Complete your part of the delegated task."


async def execute_delegation_chain(
    *,
    actor_id: str,
    delegation: dict[str, Any],
    project_path: str,
    orchestration_mode: str = "sequential",
    agent_roles: list[str] | None = None,
    style_context: str = "",
    knowledge_context: str = "",
    start_at: int = 1,
    prior_steps: list[dict[str, Any]] | None = None,
    require_step_approval: bool = False,
) -> tuple[list[dict[str, Any]], str, bool]:
    roles = parse_agent_roles(str(delegation.get("assigned_role", "agent")), agent_roles)
    if orchestration_mode == "supervisor" and len(roles) == 1:
        roles = ["supervisor", roles[0]]

    steps: list[dict[str, Any]] = list(prior_steps or [])
    prior_outputs = [
        f"{item['role']}: {str(item.get('output', ''))[:500]}"
        for item in steps
        if item.get("status") == "completed" and item.get("output")
    ]

    for index, role in enumerate(roles, start=1):
        if index < start_at:
            continue

        prefix = _role_prompt_prefix(actor_id, role)
        context_blocks = []
        if style_context:
            context_blocks.append(style_context)
        if knowledge_context:
            context_blocks.append(knowledge_context)
        if prior_outputs:
            context_blocks.append("Prior agent outputs:\n" + "\n\n".join(prior_outputs))

        prompt = (
            f"[Delegated step {index}/{len(roles)} — role: {role}]\n"
            f"{prefix}\n\n"
            f"Task:\n{delegation['task']}"
        )
        if context_blocks:
            prompt = f"{prompt}\n\n" + "\n\n".join(context_blocks)

        step = {
            "step_index": index,
            "role": role,
            "status": "in_progress",
            "output": "",
            "started_at": _utc_now(),
            "completed_at": None,
        }
        try:
            run = await build_agent_run(
                prompt=prompt,
                session_id=delegation["session_id"],
                project_path=project_path,
                current_file=None,
            )
            output = run.assistant_message[:2000]
            step["status"] = "completed"
            step["output"] = output
            step["completed_at"] = _utc_now()
            prior_outputs.append(f"{role}: {output[:500]}")
        except Exception as exc:
            step["status"] = "failed"
            step["output"] = str(exc)
            step["completed_at"] = _utc_now()
            steps.append(step)
            raise ProjectsTeamError(f"Delegation step {index} ({role}) failed: {exc}") from exc

        steps.append(step)
        if require_step_approval and index < len(roles):
            return (
                steps,
                f"Step {index} ({role}) completed; awaiting human approval before step {index + 1}",
                True,
            )

    summary = f"Completed {len(steps)} agent step(s): " + ", ".join(
        f"{item['role']}={item['status']}" for item in steps
    )
    return steps, summary, False


def steps_to_json(steps: list[dict[str, Any]]) -> str:
    return json.dumps(steps, ensure_ascii=True)
