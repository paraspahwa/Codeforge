"""Conversational discovery + PRD generation for non-technical users."""

from __future__ import annotations

import re
from typing import Any

from .agent import AgentRunResult, route_request
from .db import list_messages_for_session
from .models import AgentEvent, utc_now

DISCOVERY_PATTERNS = (
    r"\bprd\b",
    r"product requirements",
    r"app idea",
    r"want to build",
    r"help me write",
    r"create an? \w+ app",
    r"build an? app",
    r"i want to build",
    r"i have an app idea",
)

PRD_CONTEXT_PATTERNS = DISCOVERY_PATTERNS + (
    r"health",
    r"fitness",
    r"ecommerce",
    r"marketplace",
    r"saas",
    r"mobile app",
)


def _matches_patterns(text: str, patterns: tuple[str, ...]) -> bool:
    lowered = (text or "").lower()
    return any(re.search(pattern, lowered) for pattern in patterns)


def _session_messages(session_id: str) -> list[dict[str, Any]]:
    return list_messages_for_session(session_id, limit=40)


def should_ask_discovery_questions(session_id: str, user_prompt: str) -> bool:
    """First PRD/build turn: ask clarifying questions only."""
    user_messages = [row for row in _session_messages(session_id) if row.get("role") == "user"]
    if len(user_messages) != 1:
        return False
    first_prompt = str(user_messages[0].get("content") or "")
    if not _matches_patterns(first_prompt, DISCOVERY_PATTERNS):
        return False
    if "only ask" in first_prompt.lower() or "ask me" in first_prompt.lower():
        return True
    if "prd" in first_prompt.lower() or "product requirements" in first_prompt.lower():
        return True
    return _matches_patterns(user_prompt, DISCOVERY_PATTERNS)


def should_generate_prd(session_id: str, user_prompt: str) -> bool:
    """Follow-up turn after discovery: produce the PRD document."""
    rows = _session_messages(session_id)
    user_messages = [row for row in rows if row.get("role") == "user"]
    assistant_messages = [row for row in rows if row.get("role") == "assistant"]
    if len(user_messages) < 2 or not assistant_messages:
        return False

    first_user = str(user_messages[0].get("content") or "")
    if not _matches_patterns(first_user, DISCOVERY_PATTERNS):
        return False

    last_assistant = str(assistant_messages[-1].get("content") or "")
    if "?" not in last_assistant and "question" not in last_assistant.lower():
        return False

    latest_user = str(user_messages[-1].get("content") or "").strip()
    if len(latest_user.split()) < 3:
        return False

    return True


def _discovery_fallback_questions(user_prompt: str) -> str:
    topic = "your app"
    lowered = user_prompt.lower()
    if "health" in lowered:
        topic = "your health app"
    elif "fitness" in lowered:
        topic = "your fitness app"

    return f"""Great — let's shape {topic} together! Before I write your PRD, I need a few details:

1. **Who is it for?** Describe your ideal users in one sentence.
2. **What problem does it solve?** What frustration or need does it address?
3. **Top 3 features** you need at launch — what must it do on day one?
4. **Any constraints?** Platform (web/iOS/Android), timeline, or budget limits?
5. **Success metrics** — how will you know the app is working? (downloads, daily users, revenue, etc.)

Reply with as much detail as you have — even rough notes are fine. Once you answer, I'll draft your full Product Requirements Document.

**Next step:** Tell me about your users and the #1 problem you're solving."""


def _prd_fallback_document(user_prompt: str, conversation: str) -> str:
    return f"""# Product Requirements Document (Draft)

## Overview
Based on your description, here is a starter PRD. Review each section and tell me what to change.

## Problem statement
Users need a solution for the need you described: *{user_prompt.strip()[:200]}*

## Target users
- Primary users (to refine with you)
- Their goals and pain points

## Goals & success metrics
- Launch an MVP that solves the core problem
- Measure adoption and user satisfaction in the first 30 days

## Core features (MVP)
1. User onboarding and account setup
2. Core workflow for the main use case
3. Notifications or reminders (if relevant)
4. Basic settings and profile

## Out of scope (v1)
- Advanced analytics dashboard
- Third-party integrations beyond essentials

## User stories
- As a user, I want to sign up quickly so I can start using the app.
- As a user, I want to complete the main task in under 2 minutes.
- As a user, I want clear feedback when something goes wrong.

## Technical notes (handled by CodeForge)
The agent will choose the stack, project structure, and implementation plan — you don't need to decide this.

## Next steps
1. Confirm or edit this PRD
2. I'll create an implementation plan
3. Then we build feature by feature

**Next step:** Tell me which sections to expand or change, or say "looks good — create the build plan"."""


def _build_conversation_context(session_id: str) -> str:
    lines: list[str] = []
    for row in _session_messages(session_id):
        role = row.get("role")
        content = str(row.get("content") or "").strip()
        if not content:
            continue
        label = "User" if role == "user" else "Assistant"
        lines.append(f"{label}: {content}")
    return "\n\n".join(lines)


def _build_agent_result(
    *,
    assistant_message: str,
    prompt: str,
    synthesis_source: str,
    intent: str = "product_discovery",
) -> AgentRunResult:
    decision = route_request(prompt)
    timestamp = utc_now()
    return AgentRunResult(
        assistant_message=assistant_message,
        model_used=decision.model_used,
        estimated_cost_usd=decision.estimated_cost_usd,
        input_tokens=max(1, len(prompt.split())),
        output_tokens=max(12, len(assistant_message.split())),
        intent=intent,
        target_file="PRD.md",
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
        events=[
            AgentEvent(
                type="tool_result",
                sequence=1,
                timestamp=timestamp,
                payload={"tool": "product.discovery", "status": "completed", "message": intent},
            )
        ],
    )


async def maybe_discovery_response(
    *,
    session_id: str,
    user_prompt: str,
    generation_client: Any,
) -> AgentRunResult | None:
    if not should_ask_discovery_questions(session_id, user_prompt):
        return None

    system_prompt = (
        "You are CodeForge, a friendly product partner for non-technical founders. "
        "The user wants to build an app or write a PRD. "
        "Ask exactly 4-5 warm, clear questions. Do NOT write the PRD yet. "
        "Do NOT mention code, git, or file paths. "
        "Cover: target users, problem solved, top features, constraints, success metrics. "
        "End with a single line: **Next step:** Tell me about [most important missing info]."
    )

    response = await generation_client.generate(
        prompt=user_prompt,
        system_prompt=system_prompt,
        max_tokens=500,
    )
    text = str(response.get("text") or "").strip()
    if not text or text.startswith("I can help with that. To get a full AI-generated answer"):
        text = _discovery_fallback_questions(user_prompt)

    return _build_agent_result(
        assistant_message=text,
        prompt=user_prompt,
        synthesis_source=str(response.get("backend", "discovery")),
        intent="product_discovery",
    )


async def maybe_prd_response(
    *,
    session_id: str,
    user_prompt: str,
    generation_client: Any,
) -> AgentRunResult | None:
    if not should_generate_prd(session_id, user_prompt):
        return None

    conversation = _build_conversation_context(session_id)
    system_prompt = (
        "You are CodeForge, a product partner. The user answered your discovery questions. "
        "Write a complete Product Requirements Document in plain language using markdown headings: "
        "Overview, Target Users, Problem Statement, Goals & Success Metrics, Core Features (MVP), "
        "Out of Scope, User Stories, and Next Steps. "
        "Do not use heavy technical jargon. End with **Next step:** suggesting plan or build."
    )

    response = await generation_client.generate(
        prompt=conversation,
        system_prompt=system_prompt,
        max_tokens=1200,
    )
    text = str(response.get("text") or "").strip()
    if not text or text.startswith("I can help with that. To get a full AI-generated answer"):
        text = _prd_fallback_document(user_prompt, conversation)

    return _build_agent_result(
        assistant_message=text,
        prompt=user_prompt,
        synthesis_source=str(response.get("backend", "prd")),
        intent="prd_generation",
    )
