from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import os
from pathlib import Path
from typing import Any

import httpx

from .file_ops import build_patch_preview, generate_proposed_content, infer_target_file, read_file_content, read_file_excerpt
from .model_router import GenerationClient, choose_model
from .models import AgentEvent, utc_now
from .tracing import add_span_event, set_span_attributes, traced_span


generation_client = GenerationClient()


@dataclass
class RoutingDecision:
    intent: str
    model_used: str
    estimated_cost_usd: float
    reason: str
    confidence_score: float
    confidence_label: str
    review_required: bool
    routing_tier: str
    fallback_used: bool


@dataclass
class AgentRunResult:
    assistant_message: str
    model_used: str
    estimated_cost_usd: float
    input_tokens: int
    output_tokens: int
    intent: str
    target_file: str
    original_content: str
    proposed_content: str
    patch_preview: str
    confidence_score: float
    confidence_label: str
    review_required: bool
    routing_tier: str
    fallback_used: bool
    synthesis_source: str
    token_chunks: list[str]
    events: list[AgentEvent]


@dataclass
class RoutingBenchmarkCase:
    prompt: str
    expected_intent: str
    expected_tier: str


def _label_confidence(score: float) -> str:
    if score >= 0.8:
        return "high"
    if score >= 0.6:
        return "medium"
    return "low"


def _estimate_confidence(prompt: str, intent: str, model_used: str) -> float:
    lowered = prompt.lower()
    score = 0.78

    if len(prompt.split()) > 60:
        score -= 0.18
    if any(keyword in lowered for keyword in ["maybe", "unsure", "not sure", "guess", "possible"]):
        score -= 0.14
    if any(keyword in lowered for keyword in ["production", "incident", "critical", "security", "fallback"]):
        score -= 0.08
    if any(keyword in lowered for keyword in ["small", "simple", "quick", "minor"]):
        score += 0.05
    if model_used.startswith("claude"):
        score -= 0.06
    if intent == "simple_edit":
        score += 0.04

    return max(0.2, min(score, 0.95))


def _classify_intent(prompt: str) -> RoutingDecision:
    lowered = prompt.lower()

    repeat_keywords = [
        "same as before",
        "as previous",
        "like previous",
        "repeat this",
        "again for",
    ]
    if any(keyword in lowered for keyword in repeat_keywords):
        confidence = _estimate_confidence(prompt, "repeat_pattern", "context-cache")
        return RoutingDecision(
            intent="repeat_pattern",
            model_used="context-cache",
            estimated_cost_usd=0.0003,
            reason="Detected repeated-pattern language, so context cache and prior session diffs are preferred.",
            confidence_score=confidence,
            confidence_label=_label_confidence(confidence),
            review_required=False,
            routing_tier="cached_pattern",
            fallback_used=False,
        )

    clarify_keywords = [
        "what do you suggest",
        "what should i do",
        "where to start",
        "not sure",
        "confused",
    ]
    if any(keyword in lowered for keyword in clarify_keywords) or len(prompt.split()) <= 5:
        confidence = _estimate_confidence(prompt, "needs_clarify", "deepseek-v4-flash")
        return RoutingDecision(
            intent="needs_clarify",
            model_used="deepseek-v4-flash",
            estimated_cost_usd=0.0012,
            reason="Detected ambiguous or short request; routing to cheap clarify-first prompt before expensive execution.",
            confidence_score=confidence,
            confidence_label=_label_confidence(confidence),
            review_required=False,
            routing_tier="clarify_first",
            fallback_used=False,
        )

    if any(keyword in lowered for keyword in ["test", "pytest", "npm test", "cargo test", "run tests"]):
        confidence = _estimate_confidence(prompt, "shell_cmd", "rule-engine")
        return RoutingDecision(
            intent="shell_cmd",
            model_used="rule-engine",
            estimated_cost_usd=0.0,
            reason="Detected test or shell command keywords, so the local rule engine handles it.",
            confidence_score=confidence,
            confidence_label=_label_confidence(confidence),
            review_required=confidence < 0.55,
            routing_tier="local_rule",
            fallback_used=False,
        )

    frontier_keywords = [
        "frontier",
        "novel algorithm",
        "formal proof",
        "enterprise sev0",
        "critical architecture failure",
    ]
    if any(keyword in lowered for keyword in frontier_keywords):
        confidence = _estimate_confidence(prompt, "frontier_reasoning", "claude-opus-4.1")
        return RoutingDecision(
            intent="frontier_reasoning",
            model_used="claude-opus-4.1",
            estimated_cost_usd=0.036,
            reason="Detected frontier-level request keywords; escalating to Opus with explicit high-cost fallback.",
            confidence_score=confidence,
            confidence_label=_label_confidence(confidence),
            review_required=True,
            routing_tier="fallback_opus",
            fallback_used=True,
        )

    if any(keyword in lowered for keyword in ["architecture", "design", "system", "microservice", "scalability"]):
        confidence = _estimate_confidence(prompt, "complex_arch", "deepseek-v4-pro")
        return RoutingDecision(
            intent="complex_arch",
            model_used="deepseek-v4-pro",
            estimated_cost_usd=0.0068,
            reason="Architecture and system-design language requires stronger DeepSeek reasoning while staying cost-aware.",
            confidence_score=confidence,
            confidence_label=_label_confidence(confidence),
            review_required=confidence < 0.6,
            routing_tier="deepseek_pro",
            fallback_used=False,
        )

    if any(keyword in lowered for keyword in ["debug", "race condition", "incident", "production", "crash"]):
        confidence = _estimate_confidence(prompt, "hard_debug", "claude-sonnet-4.6")
        return RoutingDecision(
            intent="hard_debug",
            model_used="claude-sonnet-4.6",
            estimated_cost_usd=0.0185,
            reason="Debugging and incident keywords trigger the Sonnet fallback policy for hard-debug reliability.",
            confidence_score=confidence,
            confidence_label=_label_confidence(confidence),
            review_required=True,
            routing_tier="fallback_sonnet",
            fallback_used=True,
        )

    if any(keyword in lowered for keyword in ["refactor", "multi-file", "optimize", "performance"]):
        confidence = _estimate_confidence(prompt, "complex_edit", "deepseek-v4-pro")
        return RoutingDecision(
            intent="complex_edit",
            model_used="deepseek-v4-pro",
            estimated_cost_usd=0.0062,
            reason="Complex edit keywords route to DeepSeek Pro as the primary non-fallback path.",
            confidence_score=confidence,
            confidence_label=_label_confidence(confidence),
            review_required=confidence < 0.58,
            routing_tier="deepseek_pro",
            fallback_used=False,
        )

    confidence = _estimate_confidence(prompt, "simple_edit", "deepseek-v4-flash")
    return RoutingDecision(
        intent="simple_edit",
        model_used="deepseek-v4-flash",
        estimated_cost_usd=0.0024,
        reason="DeepSeek-first default route: using Flash for lowest-cost simple edit handling.",
        confidence_score=confidence,
        confidence_label=_label_confidence(confidence),
        review_required=confidence < 0.55,
        routing_tier="deepseek_flash",
        fallback_used=False,
    )


def _chunk_words(text: str, chunk_size: int = 3) -> list[str]:
    words = text.split()
    return [" ".join(words[index : index + chunk_size]) + " " for index in range(0, len(words), chunk_size)]


def _extract_response_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"].strip()

    output = payload.get("output")
    if isinstance(output, list):
        for item in output:
            content = item.get("content") if isinstance(item, dict) else None
            if not isinstance(content, list):
                continue
            for block in content:
                if isinstance(block, dict) and isinstance(block.get("text"), str) and block["text"].strip():
                    return block["text"].strip()

    if isinstance(payload.get("text"), str) and payload["text"].strip():
        return payload["text"].strip()

    return ""


def get_synthesis_rollout_status() -> dict[str, Any]:
    preferred = os.getenv("CODEFORGE_SYNTHESIS_PROVIDER", "auto").strip().lower() or "auto"

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    openai_model = os.getenv("CODEFORGE_SYNTHESIS_MODEL", "gpt-4o-mini").strip()

    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
    azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()

    providers = [
        {
            "provider": "openai",
            "configured": bool(openai_key),
            "selected": preferred in {"auto", "openai"} and bool(openai_key),
            "model": openai_model,
            "endpoint": f"{openai_base}/responses",
        },
        {
            "provider": "azure_openai",
            "configured": bool(azure_endpoint and azure_key and azure_deployment),
            "selected": preferred == "azure_openai" and bool(azure_endpoint and azure_key and azure_deployment),
            "model": azure_deployment,
            "endpoint": azure_endpoint,
        },
    ]

    selected_provider = "deterministic"
    for provider in providers:
        if provider["selected"]:
            selected_provider = provider["provider"]
            break
    if selected_provider == "deterministic" and preferred == "auto":
        for provider in providers:
            if provider["configured"]:
                selected_provider = provider["provider"]
                break

    return {
        "strategy": preferred,
        "selected_provider": selected_provider,
        "fallback_strategy": "deterministic",
        "providers": providers,
    }


def _synthesize_openai_compatible(
    *,
    endpoint: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    provider_label: str,
) -> tuple[str, str]:
    body = {
        "model": model_name,
        "input": [
            {
                "role": "system",
                "content": [{"type": "text", "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [{"type": "text", "text": user_prompt}],
            },
        ],
        "max_output_tokens": int(os.getenv("CODEFORGE_SYNTHESIS_MAX_TOKENS", "220")),
    }

    timeout_seconds = float(os.getenv("CODEFORGE_SYNTHESIS_TIMEOUT_SECONDS", "8"))
    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
    if response.status_code >= 400:
        return "", "deterministic"
    text = _extract_response_text(response.json())
    if not text:
        return "", "deterministic"
    return text, f"model_api:{provider_label}"


def _synthesize_azure_openai(
    *,
    endpoint: str,
    api_key: str,
    deployment: str,
    system_prompt: str,
    user_prompt: str,
) -> tuple[str, str]:
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")
    url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
    timeout_seconds = float(os.getenv("CODEFORGE_SYNTHESIS_TIMEOUT_SECONDS", "8"))
    body = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": int(os.getenv("CODEFORGE_SYNTHESIS_MAX_TOKENS", "220")),
        "temperature": float(os.getenv("CODEFORGE_SYNTHESIS_TEMPERATURE", "0.2")),
    }

    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(
            url,
            headers={
                "api-key": api_key,
                "Content-Type": "application/json",
            },
            json=body,
        )
    if response.status_code >= 400:
        return "", "deterministic"

    payload = response.json()
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        content = message.get("content") if isinstance(message, dict) else ""
        if isinstance(content, str) and content.strip():
            return content.strip(), "model_api:azure_openai"

    return "", "deterministic"


def _synthesize_with_remote_model(prompt: str, decision: RoutingDecision, target_file: str) -> tuple[str, str]:
    status = get_synthesis_rollout_status()
    preferred = status["strategy"]

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_model = os.getenv("CODEFORGE_SYNTHESIS_MODEL", "gpt-4o-mini").strip()
    openai_base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
    azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()

    system_prompt = (
        "You are CodeForge orchestration synthesis. Produce a concise developer-facing assistant response "
        "that explains the routed intent, planned file scope, and verification posture. Keep it under 90 words."
    )
    user_prompt = (
        f"Intent: {decision.intent}\n"
        f"Model route: {decision.model_used}\n"
        f"Target file: {target_file}\n"
        f"Confidence: {decision.confidence_label} ({decision.confidence_score:.2f})\n"
        f"User request: {prompt}"
    )

    provider_chain: list[str]
    if preferred == "openai":
        provider_chain = ["openai"]
    elif preferred == "azure_openai":
        provider_chain = ["azure_openai"]
    else:
        provider_chain = ["openai", "azure_openai"]

    for provider in provider_chain:
        try:
            if provider == "openai" and openai_key:
                text, source = _synthesize_openai_compatible(
                    endpoint=f"{openai_base}/responses",
                    api_key=openai_key,
                    model_name=openai_model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    provider_label="openai",
                )
                if text:
                    return text, source

            if provider == "azure_openai" and azure_endpoint and azure_key and azure_deployment:
                text, source = _synthesize_azure_openai(
                    endpoint=azure_endpoint,
                    api_key=azure_key,
                    deployment=azure_deployment,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
                if text:
                    return text, source
        except Exception:
            continue

    return "", "deterministic"


def _run_static_verification(target_file: str, proposed_content: str, original_content: str) -> dict[str, Any]:
    if proposed_content == original_content:
        return {
            "status": "warning",
            "message": "No content change detected; review whether the prompt needs stronger edit intent.",
            "checks": ["no_op_change"],
            "details": [],
        }

    suffix = target_file.lower().rsplit(".", 1)[-1] if "." in target_file else ""

    if suffix == "py":
        try:
            compile(proposed_content, target_file, "exec")
        except SyntaxError as exc:
            return {
                "status": "failed",
                "message": "Python syntax verification failed",
                "checks": ["python_compile"],
                "details": [f"line {exc.lineno}: {exc.msg}"],
            }
        return {
            "status": "completed",
            "message": "Python syntax verification passed",
            "checks": ["python_compile"],
            "details": [],
        }

    if suffix == "json":
        try:
            import json

            json.loads(proposed_content)
        except json.JSONDecodeError as exc:
            return {
                "status": "failed",
                "message": "JSON parse verification failed",
                "checks": ["json_parse"],
                "details": [f"line {exc.lineno}: {exc.msg}"],
            }
        return {
            "status": "completed",
            "message": "JSON parse verification passed",
            "checks": ["json_parse"],
            "details": [],
        }

    return {
        "status": "completed",
        "message": "Static verification passed for generic text update",
        "checks": ["text_change_detected"],
        "details": [],
    }


def classify_request(prompt: str) -> tuple[str, str, float]:
    decision = _classify_intent(prompt)
    return decision.intent, decision.model_used, decision.estimated_cost_usd


def route_request(prompt: str) -> RoutingDecision:
    decision = _classify_intent(prompt)
    routed = choose_model(prompt)
    decision.model_used = routed.model
    decision.reason = f"{decision.reason} Model router selected {routed.provider}:{routed.model} ({routed.reason})."
    return decision


def _repository_routing_cases() -> list[RoutingBenchmarkCase]:
    root = Path.cwd()
    known_files = {
        "readme": (root / "README.md").exists(),
        "api_main": (root / "services" / "api" / "app" / "main.py").exists(),
        "desktop_app": (root / "apps" / "desktop" / "src" / "App.jsx").exists(),
        "web_page": (root / "apps" / "web" / "app" / "page.jsx").exists(),
    }

    cases: list[RoutingBenchmarkCase] = []
    if known_files["readme"]:
        cases.append(
            RoutingBenchmarkCase(
                prompt="Update README.md with concise local setup troubleshooting notes",
                expected_intent="simple_edit",
                expected_tier="deepseek_flash",
            )
        )

    if known_files["api_main"]:
        cases.append(
            RoutingBenchmarkCase(
                prompt="Investigate production crash in services/api/app/main.py stream flow and debug root cause",
                expected_intent="hard_debug",
                expected_tier="fallback_sonnet",
            )
        )

    if known_files["desktop_app"]:
        cases.append(
            RoutingBenchmarkCase(
                prompt="Refactor apps/desktop/src/App.jsx state handling for better readability and lower rerender churn",
                expected_intent="complex_edit",
                expected_tier="deepseek_pro",
            )
        )

    if known_files["web_page"]:
        cases.append(
            RoutingBenchmarkCase(
                prompt="Run tests for apps/web before release and report failures",
                expected_intent="shell_cmd",
                expected_tier="local_rule",
            )
        )

    cases.append(
        RoutingBenchmarkCase(
            prompt="Repeat previous conflict strategy for same files again",
            expected_intent="repeat_pattern",
            expected_tier="cached_pattern",
        )
    )

    return cases


async def build_agent_run(
    prompt: str,
    session_id: str,
    project_path: str | None = None,
    current_file: str | None = None,
) -> AgentRunResult:
    with traced_span(
        "codeforge.agent.build_run",
        {
            "codeforge.session_id": session_id,
            "codeforge.project_path": project_path,
            "codeforge.current_file": current_file,
        },
    ):
        decision = route_request(prompt)
        timestamp = utc_now()
        input_tokens = max(1, len(prompt.split()))

        active_file = infer_target_file(project_path, prompt, current_file=current_file)
        original_content = read_file_content(project_path, active_file) if active_file else ""
        proposed_content = generate_proposed_content(active_file, prompt, original_content) if active_file else ""
        excerpt = read_file_excerpt(project_path, active_file) if active_file else ""

        fallback_summary = (
            f"Intent routed as {decision.intent.replace('_', ' ')} using {decision.model_used}. "
            f"I will inspect the request, prepare a scoped change, emit a diff for approval, and then verify the result."
        )

        diff_target = active_file or "README.md"
        patch_preview = build_patch_preview(diff_target, prompt, excerpt, original_content, proposed_content)
        set_span_attributes(
            {
                "codeforge.intent": decision.intent,
                "codeforge.model": decision.model_used,
                "codeforge.target_file": diff_target,
                "codeforge.input_tokens": input_tokens,
            }
        )
        add_span_event(
            "agent.route_decided",
            {
                "intent": decision.intent,
                "model": decision.model_used,
                "target_file": diff_target,
            },
        )

        events: list[AgentEvent] = []
        sequence = 1

        def add_event(event_type: str, payload: dict[str, Any]) -> None:
            nonlocal sequence
            events.append(
                AgentEvent(
                    type=event_type,
                    sequence=sequence,
                    timestamp=timestamp,
                    payload=payload,
                )
            )
            sequence += 1

        add_event(
            "tool_call",
            {
                "tool": "context.scan",
                "status": "completed",
                "target": diff_target,
                "reason": decision.reason,
                "confidence_score": decision.confidence_score,
                "confidence_label": decision.confidence_label,
            },
        )

        model_response = await generation_client.generate(
            prompt=(
                "You are CodeForge orchestration synthesis. Produce a concise developer-facing assistant response "
                "that explains routed intent, planned file scope, and verification posture. Keep it under 90 words.\n\n"
                f"Intent: {decision.intent}\n"
                f"Model route: {decision.model_used}\n"
                f"Target file: {diff_target}\n"
                f"Confidence: {decision.confidence_label} ({decision.confidence_score:.2f})\n"
                f"User request: {prompt}"
            ),
            system_prompt="You are CodeForge synthesis orchestrator.",
        )
        synthesized_summary = str(model_response.get("text", "")).strip()
        summary = synthesized_summary or fallback_summary
        synthesis_source = str(model_response.get("backend", "deterministic"))

        add_event(
            "tool_result",
            {
                "tool": "model.synthesize",
                "status": "completed" if synthesis_source == "litellm" else "fallback",
                "source": synthesis_source,
                "message": "Assistant summary prepared",
            },
        )

        add_event(
            "tool_result",
            {
                "tool": "file.read",
                "status": "completed",
                "target": diff_target,
                "excerpt": excerpt,
                "reason": decision.reason,
            },
        )

        add_event(
            "diff",
            {
                "file": diff_target,
                "patch": patch_preview,
                "kind": "proposed",
                "reason": decision.reason,
                "review_required": decision.review_required,
            },
        )

        add_event(
            "approval_request",
            {
                "scope": "file_diff",
                "message": f"Review the proposed update for {diff_target} before apply.",
                "reason": decision.reason,
                "review_required": decision.review_required,
                "confidence_score": decision.confidence_score,
            },
        )

        verification = _run_static_verification(diff_target, proposed_content, original_content)

        add_event(
            "tool_call",
            {
                "tool": "verify.static",
                "status": "running",
                "target": diff_target,
                "reason": decision.reason,
            },
        )

        add_event(
            "tool_result",
            {
                "tool": "verify.static",
                "status": verification["status"],
                "message": verification["message"],
                "checks": verification["checks"],
                "details": verification["details"],
                "reason": decision.reason,
            },
        )

        if verification["status"] == "failed":
            add_event(
                "tool_result",
                {
                    "tool": "verify.gate",
                    "status": "blocked",
                    "message": "Proposal requires manual correction before apply.",
                    "reason": decision.reason,
                },
            )

        output_tokens = max(12, len(summary.split()))

        add_span_event(
            "agent.run_ready",
            {
                "event_count": len(events),
                "output_tokens": output_tokens,
            },
        )

        return AgentRunResult(
            assistant_message=summary,
            model_used=decision.model_used,
            estimated_cost_usd=decision.estimated_cost_usd,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            intent=decision.intent,
            target_file=diff_target,
            original_content=original_content,
            proposed_content=proposed_content,
            patch_preview=patch_preview,
            confidence_score=decision.confidence_score,
            confidence_label=decision.confidence_label,
            review_required=decision.review_required,
            routing_tier=decision.routing_tier,
            fallback_used=decision.fallback_used,
            synthesis_source=synthesis_source,
            token_chunks=_chunk_words(summary, chunk_size=2),
            events=events,
        )


def serialize_sse_event(event_type: str, payload: dict[str, Any], sequence: int, timestamp: datetime | None = None) -> str:
    event = AgentEvent(
        type=event_type,
        sequence=sequence,
        timestamp=timestamp or utc_now(),
        payload=payload,
    )
    return f"data: {event.model_dump_json()}\n\n"


def run_routing_benchmark(suite: str = "policy") -> dict[str, Any]:
    suite_name = suite.strip().lower() or "policy"
    if suite_name not in {"policy", "repository", "all"}:
        raise ValueError("suite must be policy, repository, or all")

    policy_cases = [
        RoutingBenchmarkCase(
            prompt="Do this again for the auth module, same as before",
            expected_intent="repeat_pattern",
            expected_tier="cached_pattern",
        ),
        RoutingBenchmarkCase(
            prompt="Not sure where to start",
            expected_intent="needs_clarify",
            expected_tier="clarify_first",
        ),
        RoutingBenchmarkCase(
            prompt="Please make a small docs update in README and keep it concise",
            expected_intent="simple_edit",
            expected_tier="deepseek_flash",
        ),
        RoutingBenchmarkCase(
            prompt="Refactor this module across multiple files for better performance",
            expected_intent="complex_edit",
            expected_tier="deepseek_pro",
        ),
        RoutingBenchmarkCase(
            prompt="We have a production incident and crash loop, help debug root cause",
            expected_intent="hard_debug",
            expected_tier="fallback_sonnet",
        ),
        RoutingBenchmarkCase(
            prompt="This is a frontier request requiring formal proof-level reasoning",
            expected_intent="frontier_reasoning",
            expected_tier="fallback_opus",
        ),
    ]

    repository_cases = _repository_routing_cases()
    if suite_name == "policy":
        cases = policy_cases
    elif suite_name == "repository":
        cases = repository_cases
    else:
        cases = [*policy_cases, *repository_cases]

    results: list[dict[str, Any]] = []
    passes = 0
    total_cost = 0.0
    fallback_count = 0
    low_confidence = 0

    for case in cases:
        decision = route_request(case.prompt)
        pass_intent = decision.intent == case.expected_intent
        pass_tier = decision.routing_tier == case.expected_tier
        passed = pass_intent and pass_tier
        if passed:
            passes += 1
        if decision.fallback_used:
            fallback_count += 1
        if decision.confidence_label == "low":
            low_confidence += 1

        total_cost += decision.estimated_cost_usd
        results.append(
            {
                "prompt": case.prompt,
                "expected_intent": case.expected_intent,
                "actual_intent": decision.intent,
                "expected_tier": case.expected_tier,
                "actual_tier": decision.routing_tier,
                "model": decision.model_used,
                "fallback_used": decision.fallback_used,
                "confidence_score": round(decision.confidence_score, 3),
                "passed": passed,
            }
        )

    total = len(cases)
    return {
        "suite": suite_name,
        "total_cases": total,
        "passed_cases": passes,
        "pass_rate": round((passes / total) if total else 0.0, 3),
        "fallback_usage_rate": round((fallback_count / total) if total else 0.0, 3),
        "low_confidence_rate": round((low_confidence / total) if total else 0.0, 3),
        "total_estimated_cost_usd": round(total_cost, 6),
        "results": results,
    }