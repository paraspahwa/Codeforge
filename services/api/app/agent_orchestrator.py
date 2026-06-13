"""Run typed agents — architectural and operational roles."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from .agent import AgentRunResult, generation_client, route_request
from .agent_loop_v2 import AgentLoopV2Config, AgentLoopV2Result, build_agent_run_v2
from .agent_registry import get_agent, normalize_agent_type
from .db import list_messages_for_session
from .discovery_service import maybe_discovery_response, maybe_prd_response
from .models import AgentEvent, utc_now
from .subagent_service import spawn_subagent_task

# Simple reflex rules (pattern → action)
REFLEX_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(spam|junk|phishing)\b", re.I), "🚫 **Reflex:** Flag as spam and quarantine. No further action needed."),
    (re.compile(r"\b(thermostat|temperature|too hot|too cold|ac|heat)\b", re.I), "🌡️ **Reflex:** Temperature above threshold → activate cooling to target 24°C."),
    (re.compile(r"\b(stop|cancel|abort|halt)\b", re.I), "⏹️ **Reflex:** Stop current operation immediately."),
    (re.compile(r"\b(help|how do i|what is)\b", re.I), "❓ **Reflex:** Route to conversational guide — explain in plain language."),
    (re.compile(r"\b(bug|broken|error|crash)\b", re.I), "🐛 **Reflex:** Route to debug workflow — reproduce, diagnose, fix."),
    (re.compile(r"\b(prd|requirements|product doc)\b", re.I), "📋 **Reflex:** Route to PRD discovery — ask clarifying questions first."),
]


def _build_result(
    *,
    assistant_message: str,
    prompt: str,
    intent: str,
    synthesis_source: str,
    events: list[AgentEvent] | None = None,
    target_file: str = "README.md",
) -> AgentLoopV2Result:
    decision = route_request(prompt)
    return AgentLoopV2Result(
        run=AgentRunResult(
            assistant_message=assistant_message,
            model_used=decision.model_used,
            estimated_cost_usd=decision.estimated_cost_usd,
            input_tokens=max(1, len(prompt.split())),
            output_tokens=max(12, len(assistant_message.split())),
            intent=intent,
            target_file=target_file,
            original_content="",
            proposed_content="",
            patch_preview="",
            confidence_score=decision.confidence_score,
            confidence_label=decision.confidence_label,
            review_required=False,
            routing_tier=decision.routing_tier,
            fallback_used=decision.fallback_used,
            synthesis_source=synthesis_source,
            token_chunks=assistant_message.split(),
            events=events
            or [
                AgentEvent(
                    type="tool_result",
                    sequence=1,
                    timestamp=utc_now(),
                    payload={"tool": "agent.typed", "status": "completed", "intent": intent},
                )
            ],
        )
    )


async def _llm_reply(
    *,
    user_prompt: str,
    system_prompt: str,
    max_tokens: int = 600,
    intent: str,
) -> AgentLoopV2Result:
    response = await generation_client.generate(
        prompt=user_prompt,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
    )
    text = str(response.get("text") or "").strip()
    if not text:
        text = "I'm ready to help. Tell me more about what you need."
    return _build_result(
        assistant_message=text,
        prompt=user_prompt,
        intent=intent,
        synthesis_source=str(response.get("backend", "llm")),
    )


def _session_context_text(session_id: str, limit: int = 8) -> str:
    rows = list_messages_for_session(session_id, limit=limit)
    lines: list[str] = []
    for row in rows:
        role = row.get("role", "user")
        content = str(row.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content[:300]}")
    return "\n".join(lines)


async def run_simple_reflex(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    for pattern, action in REFLEX_RULES:
        if pattern.search(user_prompt):
            return _build_result(
                assistant_message=action,
                prompt=user_prompt,
                intent="simple_reflex",
                synthesis_source="reflex_rules",
            )
    return _build_result(
        assistant_message=(
            "⚡ **Reflex agent** — no matching rule for this input.\n\n"
            "Try keywords like: *help*, *bug*, *prd*, *stop*, or *temperature*.\n\n"
            "**Next step:** Rephrase your request or switch to the Conversational agent."
        ),
        prompt=user_prompt,
        intent="simple_reflex",
        synthesis_source="reflex_fallback",
    )


async def run_model_reflex(*, session_id: str, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    history = _session_context_text(session_id)
    system = (
        "You are a model-based reflex agent. You have memory of this session. "
        "Summarize relevant past context in 1-2 sentences, then give ONE immediate action for the latest user message. "
        "No long plans — react with awareness of history."
    )
    prompt = f"Session history:\n{history or '(empty)'}\n\nLatest request:\n{user_prompt}"
    return await _llm_reply(user_prompt=prompt, system_prompt=system, intent="model_reflex")


async def run_goal_based(
    *,
    user_prompt: str,
    session_id: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    plan_mode: bool,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    system = (
        "You are a goal-based agent. The user gave you a final objective. "
        "Output: (1) Restated goal, (2) Numbered action plan (5-8 steps), (3) Risks, (4) **Next step:** first action. "
        "Use plain language. Do not execute code yet unless user says go."
    )
    plan_result = await _llm_reply(user_prompt=user_prompt, system_prompt=system, max_tokens=800, intent="goal_based")
    if plan_mode:
        return plan_result
    # Optionally chain into execution
    return await build_agent_run_v2(
        prompt=f"{user_prompt}\n\nExecute step 1 of your plan.",
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(plan_mode=False, permission_mode=permission_mode),
    )


async def run_utility_based(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    system = (
        "You are a utility-based agent. Compare exactly 3 approaches to the user's task. "
        "For each: name, pros, cons. Score each 1-10 on speed, cost, safety, quality. "
        "Pick the winner with a utility table. End with **Next step:**."
    )
    return await _llm_reply(user_prompt=user_prompt, system_prompt=system, max_tokens=900, intent="utility_based")


async def run_learning_agent(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    memory_context: str = "",
    taste_context: str = "",
    **_kwargs: Any,
) -> AgentLoopV2Result:
    blocks = []
    if taste_context:
        blocks.append(f"Learned taste preferences:\n{taste_context[:1500]}")
    if memory_context:
        blocks.append(f"Memory:\n{memory_context[:1500]}")
    blocks.append(f"Recent session:\n{_session_context_text(session_id, limit=6)}")
    system = (
        "You are a learning agent. Adapt your response using the user's past preferences and memory. "
        "Mention one thing you learned from their history. Then address their request. "
        "End with **Next step:**."
    )
    prompt = f"{user_prompt}\n\n---\n" + "\n\n".join(blocks)
    return await _llm_reply(user_prompt=prompt, system_prompt=system, max_tokens=700, intent="learning")


async def run_conversational(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    plan_mode: bool,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    discovery = await maybe_discovery_response(
        session_id=session_id,
        user_prompt=user_prompt,
        generation_client=generation_client,
    )
    if discovery is not None:
        return AgentLoopV2Result(run=discovery)

    prd = await maybe_prd_response(
        session_id=session_id,
        user_prompt=user_prompt,
        generation_client=generation_client,
    )
    if prd is not None:
        return AgentLoopV2Result(run=prd)

    system = (
        "You are CodeForge conversational agent. Plain language only. "
        "Guide non-technical users: discover → PRD → plan → build. End with **Next step:**."
    )
    response = await generation_client.generate(
        prompt=composed_prompt or user_prompt,
        system_prompt=system,
        max_tokens=700,
    )
    text = str(response.get("text") or "").strip() or "Tell me more about what you'd like to build."
    return _build_result(
        assistant_message=text,
        prompt=user_prompt,
        intent="conversational",
        synthesis_source=str(response.get("backend", "conversational")),
    )


async def run_task_orchestration(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    plan_mode: bool,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    return await build_agent_run_v2(
        prompt=composed_prompt or user_prompt,
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(
            plan_mode=plan_mode,
            permission_mode=permission_mode,
            use_llm_planner=True,
            checkpoints_enabled=True,
        ),
    )


async def run_coding_devops(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    plan_mode: bool,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    coding_prompt = (
        "[Coding & DevOps Agent] Prefer: read_file, write_file, run_shell, git_status, git_diff, web_search. "
        "Run tests after changes. Explain in plain language.\n\n"
        f"{composed_prompt or user_prompt}"
    )
    return await build_agent_run_v2(
        prompt=coding_prompt,
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(
            plan_mode=plan_mode,
            permission_mode=permission_mode,
            use_llm_planner=True,
            max_steps=10,
        ),
    )


async def run_hierarchical(
    *,
    session_id: str,
    user_prompt: str,
    project_path: str | None,
    user_id: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    roles = ["supervisor", "researcher", "builder", "reviewer"]
    supervisor_system = (
        "You are the supervisor agent. Break the user's goal into exactly 3 subtasks for: "
        "researcher (gather info), builder (implement), reviewer (quality check). "
        "Output JSON array: [{\"role\":\"researcher\",\"task\":\"...\"}, ...]"
    )
    plan_resp = await generation_client.generate(
        prompt=user_prompt,
        system_prompt=supervisor_system,
        max_tokens=500,
    )
    plan_text = str(plan_resp.get("text") or "")

    subtasks: list[dict[str, str]] = []
    try:
        match = re.search(r"\[[\s\S]*\]", plan_text)
        if match:
            subtasks = json.loads(match.group())
    except json.JSONDecodeError:
        subtasks = []

    if not subtasks:
        subtasks = [
            {"role": "researcher", "task": f"Research context for: {user_prompt[:200]}"},
            {"role": "builder", "task": f"Propose implementation for: {user_prompt[:200]}"},
            {"role": "reviewer", "task": f"Review risks and tests for: {user_prompt[:200]}"},
        ]

    lines = ["## Hierarchical Agent — Supervisor Report\n", f"**Goal:** {user_prompt}\n", "### Delegated subtasks\n"]
    for item in subtasks[:3]:
        role = item.get("role", "worker")
        task = item.get("task", user_prompt)
        lines.append(f"- **{role}:** {task[:120]}…")

    path = project_path or ""
    for item in subtasks[:3]:
        role = item.get("role", "worker")
        task = str(item.get("task") or user_prompt)
        result = await spawn_subagent_task(
            session_id=session_id,
            user_id=user_id,
            project_path=path,
            task=f"[{role}] {task}",
        )
        lines.append(f"\n### {role.title()} output\n{result.get('summary', 'done')}")
        excerpt = result.get("assistant_excerpt", "")
        if excerpt:
            lines.append(f"\n> {excerpt[:400]}")

    lines.append("\n**Next step:** Review worker outputs and say which subtask to expand.")
    message = "\n".join(lines)
    return _build_result(
        assistant_message=message,
        prompt=user_prompt,
        intent="hierarchical",
        synthesis_source="hierarchical_supervisor",
    )


async def run_multi_agent_swarm(
    *,
    session_id: str,
    user_prompt: str,
    project_path: str | None,
    user_id: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    specialists = [
        ("security", f"Security angle: {user_prompt}"),
        ("ux", f"UX angle: {user_prompt}"),
        ("performance", f"Performance angle: {user_prompt}"),
    ]
    path = project_path or ""

    async def _run_specialist(role: str, task: str) -> dict[str, Any]:
        return await spawn_subagent_task(
            session_id=session_id,
            user_id=user_id,
            project_path=path,
            task=f"[Swarm:{role}] {task}",
        )

    results = await asyncio.gather(*[_run_specialist(role, task) for role, task in specialists])

    lines = [
        "## Multi-Agent Swarm — Merged Report\n",
        f"**Query:** {user_prompt}\n",
        "Three specialists analyzed in parallel:\n",
    ]
    for (role, _), result in zip(specialists, results, strict=True):
        lines.append(f"### 🔹 {role.title()} agent\n{result.get('summary', 'completed')}")
        excerpt = result.get("assistant_excerpt", "")
        if excerpt:
            lines.append(f"\n{excerpt[:350]}\n")

    lines.append("**Next step:** Tell me which specialist finding to act on first.")
    return _build_result(
        assistant_message="\n".join(lines),
        prompt=user_prompt,
        intent="multi_agent_swarm",
        synthesis_source="swarm_parallel",
    )


async def run_react(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    plan_mode: bool,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    react_prompt = (
        "[ReAct Agent] For each step output:\n"
        "**Thought:** reasoning\n**Action:** tool or command\n**Observation:** result\n"
        "Repeat until done.\n\n"
        f"{composed_prompt or user_prompt}"
    )
    return await build_agent_run_v2(
        prompt=react_prompt,
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(plan_mode=plan_mode, permission_mode=permission_mode, use_llm_planner=True, max_steps=8),
    )


async def run_reflection(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    draft = await _llm_reply(
        user_prompt=user_prompt,
        system_prompt="You are a generator agent. Produce a first draft for the user's request.",
        intent="reflection_draft",
    )
    draft_text = draft.run.assistant_message
    critique = await _llm_reply(
        user_prompt=f"Draft to review:\n{draft_text}\n\nOriginal request:\n{user_prompt}",
        system_prompt="You are a strict critic. List flaws, security issues, and gaps. Be specific.",
        intent="reflection_critique",
    )
    final = await _llm_reply(
        user_prompt=(
            f"Original request:\n{user_prompt}\n\nDraft:\n{draft_text}\n\nCritique:\n{critique.run.assistant_message}\n\n"
            "Rewrite addressing every critique. Output only the final version."
        ),
        system_prompt="You are a reflection agent delivering the corrected final output.",
        max_tokens=900,
        intent="reflection",
    )
    message = f"## Reflection Agent\n\n### Final output\n{final.run.assistant_message}"
    return _build_result(
        assistant_message=message,
        prompt=user_prompt,
        intent="reflection",
        synthesis_source="reflection_loop",
    )


async def run_planning(
    *,
    user_prompt: str,
    session_id: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    plan_mode: bool,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    roadmap = await _llm_reply(
        user_prompt=user_prompt,
        system_prompt=(
            "Planning agent: output (1) Goal, (2) Full A→Z roadmap with numbered steps, "
            "(3) Replan triggers if a step fails, (4) First step to execute now."
        ),
        max_tokens=900,
        intent="planning_roadmap",
    )
    if plan_mode:
        return roadmap
    return await build_agent_run_v2(
        prompt=f"{user_prompt}\n\nExecute step 1 of this roadmap:\n{roadmap.run.assistant_message[:2000]}",
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(plan_mode=False, permission_mode=permission_mode, use_llm_planner=True),
    )


async def run_sequential_chain(
    *,
    session_id: str,
    user_prompt: str,
    project_path: str | None,
    user_id: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    stages = [
        ("researcher", "Gather facts and constraints only — no prose polish."),
        ("writer", "Turn research notes into a clear draft."),
        ("editor", "Polish the draft for clarity, structure, and accuracy."),
    ]
    path = project_path or ""
    artifact = user_prompt
    lines = ["## Sequential Chain Pipeline\n", f"**Input:** {user_prompt}\n"]
    for role, instruction in stages:
        result = await spawn_subagent_task(
            session_id=session_id,
            user_id=user_id,
            project_path=path,
            task=f"[{role}] {instruction}\n\nInput:\n{artifact[:2500]}",
        )
        excerpt = result.get("assistant_excerpt") or result.get("summary", "")
        artifact = excerpt or artifact
        lines.append(f"### {role.title()}\n{excerpt[:500]}\n")
    lines.append("**Next step:** Approve the pipeline output or request another pass.")
    return _build_result(
        assistant_message="\n".join(lines),
        prompt=user_prompt,
        intent="sequential_chain",
        synthesis_source="pipeline_chain",
    )


async def run_hitl(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    plan_mode: bool,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    return await build_agent_run_v2(
        prompt=(
            "[Human-in-the-Loop] Pause and request explicit approval before irreversible actions "
            "(deploy, delete, email customers, payments).\n\n"
            f"{composed_prompt or user_prompt}"
        ),
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(
            plan_mode=plan_mode,
            permission_mode="ask",
            checkpoints_enabled=True,
            use_llm_planner=True,
        ),
    )


async def run_critic_generator(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    proposal = await _llm_reply(
        user_prompt=user_prompt,
        system_prompt="Generator agent: propose the best strategy or solution.",
        intent="critic_generator_proposal",
    )
    debate_lines = ["## Critic-Generator Debate\n", f"**Request:** {user_prompt}\n", "### Round 1 — Proposal\n", proposal.run.assistant_message]
    current = proposal.run.assistant_message
    for round_num in range(1, 3):
        critic = await _llm_reply(
            user_prompt=f"Attack this proposal:\n{current}",
            system_prompt="Critic agent: find holes, risks, and failure modes. Be adversarial.",
            intent="critic_generator_critique",
        )
        debate_lines.append(f"\n### Round {round_num} — Critic\n{critic.run.assistant_message}")
        revision = await _llm_reply(
            user_prompt=f"Original:\n{user_prompt}\n\nProposal:\n{current}\n\nCritique:\n{critic.run.assistant_message}\n\nRevise.",
            system_prompt="Generator agent: harden the proposal against the critique.",
            intent="critic_generator_revision",
        )
        current = revision.run.assistant_message
        debate_lines.append(f"\n### Round {round_num} — Revision\n{current}")
    debate_lines.append("\n**Next step:** Accept the hardened strategy or request another debate round.")
    return _build_result(
        assistant_message="\n".join(debate_lines),
        prompt=user_prompt,
        intent="critic_generator",
        synthesis_source="debate_loop",
    )


async def _industry_reply(*, user_prompt: str, system_prompt: str, intent: str) -> AgentLoopV2Result:
    return await _llm_reply(user_prompt=user_prompt, system_prompt=system_prompt, max_tokens=800, intent=intent)


async def run_revenue_sdr(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    return await _industry_reply(
        user_prompt=user_prompt,
        system_prompt="SDR agent: research prospect, draft hyper-personalized outreach, propose meeting times.",
        intent="revenue_sdr",
    )


async def run_support_resolution(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    return await build_agent_run_v2(
        prompt=f"[Support Resolution] Resolve end-to-end with tools when needed.\n\n{composed_prompt or user_prompt}",
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(permission_mode=permission_mode, use_llm_planner=True),
    )


async def run_software_engineer_cloud(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    return await build_agent_run_v2(
        prompt=(
            "[Cloud Software Engineer] Full ticket workflow: plan, implement, run tests, fix failures.\n\n"
            f"{composed_prompt or user_prompt}"
        ),
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(permission_mode=permission_mode, use_llm_planner=True, max_steps=12),
    )


async def run_secops_pentest(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    return await _industry_reply(
        user_prompt=user_prompt,
        system_prompt="SecOps agent: enumerate attack surface, simulate threats, trace exploits, recommend remediations.",
        intent="secops_pentest",
    )


async def run_idp_document(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    return await _industry_reply(
        user_prompt=user_prompt,
        system_prompt="IDP agent: extract structured fields from document descriptions; output JSON for ERP import.",
        intent="idp_document",
    )


async def run_compliance_regulatory(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    return await _industry_reply(
        user_prompt=user_prompt,
        system_prompt="Compliance agent: audit policies against GDPR/tax/finance rules; list gaps and remediations.",
        intent="compliance_regulatory",
    )


async def run_edge_local(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    return await _industry_reply(
        user_prompt=user_prompt,
        system_prompt="Edge/local agent: fast, concise, privacy-first — minimize external dependencies.",
        intent="edge_local",
    )


async def run_cloud_sandbox(
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    permission_mode: str,
    **_kwargs: Any,
) -> AgentLoopV2Result:
    return await build_agent_run_v2(
        prompt=f"[Cloud Sandbox] Safe isolated execution for heavy deps and terminal work.\n\n{composed_prompt or user_prompt}",
        session_id=session_id,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        user_prompt=user_prompt,
        config=AgentLoopV2Config(permission_mode=permission_mode, use_llm_planner=True, max_steps=10),
    )


async def run_browser_rpa(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    return await _industry_reply(
        user_prompt=user_prompt,
        system_prompt="Browser/RPA agent: describe GUI steps — navigate, click, fill forms — when APIs are unavailable.",
        intent="browser_rpa",
    )


async def run_ephemeral(*, user_prompt: str, **_kwargs: Any) -> AgentLoopV2Result:
    return await _industry_reply(
        user_prompt=user_prompt,
        system_prompt="Ephemeral agent: solve only this task; do not reference prior sessions or long-term memory.",
        intent="ephemeral",
    )


async def run_persistent_memory(
    *,
    session_id: str,
    user_prompt: str,
    memory_context: str = "",
    taste_context: str = "",
    **_kwargs: Any,
) -> AgentLoopV2Result:
    return await run_learning_agent(
        session_id=session_id,
        user_prompt=user_prompt,
        composed_prompt=user_prompt,
        memory_context=memory_context,
        taste_context=taste_context,
    )


HANDLERS = {
    "simple_reflex": run_simple_reflex,
    "model_reflex": run_model_reflex,
    "goal_based": run_goal_based,
    "utility_based": run_utility_based,
    "learning": run_learning_agent,
    "react": run_react,
    "reflection": run_reflection,
    "planning": run_planning,
    "orchestrator_worker": run_hierarchical,
    "sequential_chain": run_sequential_chain,
    "parallel_fanout": run_multi_agent_swarm,
    "swarm_p2p": run_multi_agent_swarm,
    "hierarchical": run_hierarchical,
    "multi_agent_swarm": run_multi_agent_swarm,
    "hitl": run_hitl,
    "critic_generator": run_critic_generator,
    "revenue_sdr": run_revenue_sdr,
    "support_resolution": run_support_resolution,
    "software_engineer_cloud": run_software_engineer_cloud,
    "secops_pentest": run_secops_pentest,
    "idp_document": run_idp_document,
    "compliance_regulatory": run_compliance_regulatory,
    "edge_local": run_edge_local,
    "cloud_sandbox": run_cloud_sandbox,
    "browser_rpa": run_browser_rpa,
    "ephemeral": run_ephemeral,
    "persistent_memory": run_persistent_memory,
    "conversational": run_conversational,
    "task_orchestration": run_task_orchestration,
    "coding_devops": run_coding_devops,
}


async def run_typed_agent(
    agent_type: str | None,
    *,
    session_id: str,
    user_prompt: str,
    composed_prompt: str,
    project_path: str | None,
    current_file: str | None,
    user_id: str,
    plan_mode: bool = False,
    permission_mode: str = "auto_safe",
    memory_context: str = "",
    taste_context: str = "",
) -> AgentLoopV2Result:
    normalized = normalize_agent_type(agent_type)
    agent_def = get_agent(normalized)
    handler = HANDLERS.get(normalized, run_conversational)
    return await handler(
        session_id=session_id,
        user_prompt=user_prompt,
        composed_prompt=composed_prompt,
        project_path=project_path,
        current_file=current_file,
        user_id=user_id,
        plan_mode=plan_mode,
        permission_mode=permission_mode,
        memory_context=memory_context,
        taste_context=taste_context,
        agent_def=agent_def,
    )
