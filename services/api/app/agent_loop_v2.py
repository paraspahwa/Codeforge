from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from .agent import AgentRunResult, _format_assistant_reply, _language_for_file, build_agent_run, generation_client, route_request
from .agent_tools import ToolContext, ToolResult, execute_tool, infer_tool_plan, parse_tool_plan_with_llm
from .file_ops import build_patch_preview, infer_target_file, read_file_content
from .models import AgentEvent, utc_now
from .workflow_ops import capture_file_snapshot, restore_file_snapshot


@dataclass
class AgentLoopV2Config:
    max_steps: int = 8
    plan_mode: bool = False
    permission_mode: str = "auto_safe"
    use_llm_planner: bool = True
    checkpoints_enabled: bool = True


@dataclass
class AgentLoopV2Result:
    run: AgentRunResult
    tool_results: list[ToolResult] = field(default_factory=list)
    plan_steps: list[dict[str, Any]] = field(default_factory=list)
    checkpoint_id: str | None = None
    structured_plan: dict[str, Any] | None = None


def _extract_file_targets(prompt: str, project_path: str | None, current_file: str | None) -> list[str]:
    paths = re.findall(r"[`'\"]?([\w./-]+\.(?:py|js|ts|tsx|jsx|md|json|go|rs|java))[`'\"]?", prompt)
    unique: list[str] = []
    for path in paths:
        if path not in unique:
            unique.append(path)
    if current_file and current_file not in unique:
        unique.insert(0, current_file)
    if not unique:
        inferred = infer_target_file(project_path, prompt, current_file=current_file)
        if inferred:
            unique.append(inferred)
    return unique[:12]


async def build_batch_write_plan(
    prompt: str,
    project_path: str,
    current_file: str | None,
) -> list[dict[str, Any]]:
    targets = _extract_file_targets(prompt, project_path, current_file)
    if len(targets) <= 1:
        return [{"tool": "write_file", "args": {"path": targets[0] if targets else "", "prompt": prompt}}]
    return [{"tool": "write_file", "args": {"path": target, "prompt": f"{prompt}\nFocus on file: {target}"}} for target in targets]


async def execute_tool_plan(
    steps: list[dict[str, Any]],
    ctx: ToolContext,
    *,
    max_steps: int,
    checkpoints_enabled: bool,
) -> tuple[list[ToolResult], str | None]:
    results: list[ToolResult] = []
    checkpoint_id: str | None = None
    write_targets = [
        str(step.get("args", {}).get("path", "")).strip()
        for step in steps
        if step.get("tool") == "write_file" and str(step.get("args", {}).get("path", "")).strip()
    ]
    if checkpoints_enabled and write_targets and not ctx.plan_mode:
        snapshot = capture_file_snapshot(ctx.project_path, write_targets)
        checkpoint_id = f"chk_{uuid4().hex[:12]}"
        from .checkpoint_service import save_checkpoint

        save_checkpoint(
            checkpoint_id=checkpoint_id,
            session_id=ctx.session_id,
            user_id=ctx.user_id,
            project_path=ctx.project_path,
            snapshot=snapshot,
            label="pre-batch-apply",
        )

    for step in steps[:max_steps]:
        tool = str(step.get("tool", ""))
        args = step.get("args") if isinstance(step.get("args"), dict) else {}
        result = await execute_tool(tool, args, ctx)
        results.append(result)
        if result.blocked:
            break
    return results, checkpoint_id


def _synthesize_loop_message(
    prompt: str,
    tool_results: list[ToolResult],
    edited_files: list[str],
    structured_plan: dict[str, Any] | None,
    plan_mode: bool,
) -> str:
    if plan_mode and structured_plan:
        lines = ["**Plan mode** — review this plan before execution:", ""]
        for index, step in enumerate(structured_plan.get("steps", []), start=1):
            lines.append(f"{index}. `{step.get('tool')}` — {json.dumps(step.get('args', {}))}")
        if structured_plan.get("risks"):
            lines.extend(["", "**Risks:**", structured_plan["risks"]])
        return "\n".join(lines)

    lines = []
    if edited_files:
        primary = edited_files[0]
        content = ""
        for result in tool_results:
            if result.tool == "write_file" and result.data.get("path") == primary:
                from .file_ops import read_file_content

                content = read_file_content(structured_plan.get("project_path", "") if structured_plan else "", primary)
        if not content:
            for result in tool_results:
                if result.tool == "read_file" and result.data.get("content"):
                    content = result.data["content"]
                    break
        intro = f"Completed task across {len(edited_files)} file(s)." if len(edited_files) > 1 else f"Updated `{primary}`."
        if content:
            lang = _language_for_file(primary)
            return _format_assistant_reply(intro, primary, content, "")
        lines.append(intro)

    for result in tool_results:
        if result.tool in {"web_search", "run_shell", "git_status", "search_symbols"}:
            lines.append(f"- **{result.tool}**: {result.message[:200]}")

    if not lines:
        lines.append("Task completed.")
    return "\n".join(lines)


async def build_agent_run_v2(
    *,
    prompt: str,
    session_id: str,
    project_path: str | None,
    current_file: str | None = None,
    style_instructions: str = "",
    config: AgentLoopV2Config | None = None,
    user_id: str = "system",
) -> AgentLoopV2Result:
    cfg = config or AgentLoopV2Config()
    decision = route_request(prompt)
    timestamp = utc_now()
    events: list[AgentEvent] = []
    sequence = 1

    def add_event(event_type: str, payload: dict[str, Any]) -> None:
        nonlocal sequence
        events.append(AgentEvent(type=event_type, sequence=sequence, timestamp=timestamp, payload=payload))
        sequence += 1

    ctx = ToolContext(
        session_id=session_id,
        user_id=user_id,
        project_path=project_path or "",
        current_file=current_file,
        plan_mode=cfg.plan_mode,
        permission_mode=cfg.permission_mode,
    )

    steps: list[dict[str, Any]] = []
    if cfg.use_llm_planner:
        steps = await parse_tool_plan_with_llm(prompt, generation_client) or []
    if not steps:
        if len(_extract_file_targets(prompt, project_path, current_file)) > 1:
            steps = await build_batch_write_plan(prompt, project_path or "", current_file)
        else:
            steps = infer_tool_plan(prompt, current_file)

    structured_plan = {
        "steps": steps,
        "risks": "Verify tests after apply." if any(s.get("tool") == "write_file" for s in steps) else "",
        "project_path": project_path,
    }

    add_event("thinking", {"content": f"Analyzing task with {len(steps)} planned step(s)…"})

    if cfg.plan_mode:
        assistant_message = _synthesize_loop_message(prompt, [], [], structured_plan, plan_mode=True)
        run = AgentRunResult(
            assistant_message=assistant_message,
            model_used=decision.model_used,
            estimated_cost_usd=decision.estimated_cost_usd,
            input_tokens=max(1, len(prompt.split())),
            output_tokens=max(12, len(assistant_message.split())),
            intent=decision.intent,
            target_file=current_file or (steps[0].get("args", {}).get("path") if steps else "README.md"),
            original_content="",
            proposed_content="",
            patch_preview="",
            confidence_score=decision.confidence_score,
            confidence_label=decision.confidence_label,
            review_required=False,
            routing_tier=decision.routing_tier,
            fallback_used=decision.fallback_used,
            synthesis_source="plan_mode",
            token_chunks=assistant_message.split(),
            events=events,
        )
        add_event("tool_result", {"tool": "plan.mode", "status": "pending", "steps": steps})
        return AgentLoopV2Result(run=run, tool_results=[], plan_steps=steps, structured_plan=structured_plan)

    parallel_writes = [s for s in steps if s.get("tool") == "write_file"]
    other_steps = [s for s in steps if s.get("tool") != "write_file"]

    tool_results: list[ToolResult] = []
    checkpoint_id: str | None = None

    for step in other_steps:
        add_event("tool_call", {"tool": step["tool"], "status": "running", "args": step.get("args", {})})
        result = await execute_tool(step["tool"], step.get("args", {}), ctx)
        tool_results.append(result)
        add_event("tool_result", {"tool": step["tool"], "status": result.status, "message": result.message})

    if len(parallel_writes) > 1:
        write_targets = [str(s.get("args", {}).get("path", "")).strip() for s in parallel_writes]
        write_targets = [t for t in write_targets if t]
        if cfg.checkpoints_enabled and write_targets:
            snapshot = capture_file_snapshot(ctx.project_path, write_targets)
            checkpoint_id = f"chk_{uuid4().hex[:12]}"
            from .checkpoint_service import save_checkpoint

            save_checkpoint(
                checkpoint_id=checkpoint_id,
                session_id=session_id,
                user_id=user_id,
                project_path=ctx.project_path,
                snapshot=snapshot,
                label="pre-parallel-write",
            )
            add_event("checkpoint_created", {"checkpoint_id": checkpoint_id, "files": write_targets})

        async def _run_write(step: dict[str, Any]) -> ToolResult:
            add_event("tool_call", {"tool": "write_file", "status": "running", "args": step.get("args", {})})
            result = await execute_tool("write_file", step.get("args", {}), ctx)
            add_event("tool_result", {"tool": "write_file", "status": result.status, "message": result.message})
            return result

        write_results = await asyncio.gather(*[_run_write(step) for step in parallel_writes[:cfg.max_steps]])
        tool_results.extend(write_results)
    elif parallel_writes:
        results, checkpoint_id = await execute_tool_plan(
            parallel_writes,
            ctx,
            max_steps=cfg.max_steps,
            checkpoints_enabled=cfg.checkpoints_enabled,
        )
        tool_results.extend(results)
        if checkpoint_id:
            add_event("checkpoint_created", {"checkpoint_id": checkpoint_id})

    primary_file = ctx.edited_files[0] if ctx.edited_files else (infer_target_file(project_path, prompt, current_file) or "README.md")
    original_content = read_file_content(project_path, primary_file) if primary_file else ""

    if not ctx.edited_files and not any(r.tool == "write_file" and r.status == "completed" for r in tool_results):
        legacy = await build_agent_run(
            prompt=prompt,
            session_id=session_id,
            project_path=project_path,
            current_file=current_file,
            style_instructions=style_instructions,
        )
        legacy.events = events + legacy.events
        return AgentLoopV2Result(run=legacy, tool_results=tool_results, plan_steps=steps, checkpoint_id=checkpoint_id)

    proposed_content = read_file_content(project_path, primary_file) if ctx.edited_files else original_content
    assistant_message = _synthesize_loop_message(prompt, tool_results, ctx.edited_files, structured_plan, plan_mode=False)
    patch_preview = build_patch_preview(primary_file, prompt, "", original_content, proposed_content)

    run = AgentRunResult(
        assistant_message=assistant_message,
        model_used=decision.model_used,
        estimated_cost_usd=decision.estimated_cost_usd,
        input_tokens=max(1, len(prompt.split())),
        output_tokens=max(12, len(assistant_message.split())),
        intent=decision.intent,
        target_file=primary_file,
        original_content=original_content,
        proposed_content=proposed_content,
        patch_preview=patch_preview,
        confidence_score=decision.confidence_score,
        confidence_label=decision.confidence_label,
        review_required=False,
        routing_tier=decision.routing_tier,
        fallback_used=decision.fallback_used,
        synthesis_source="agent_loop_v2",
        token_chunks=assistant_message.split(),
        events=events,
    )
    return AgentLoopV2Result(
        run=run,
        tool_results=tool_results,
        plan_steps=steps,
        checkpoint_id=checkpoint_id,
        structured_plan=structured_plan,
    )
