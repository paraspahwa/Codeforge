from __future__ import annotations

import os
from typing import Any


def _env_item(name: str, required: bool, description: str) -> dict[str, Any]:
    return {
        "name": name,
        "required": required,
        "set": bool(os.getenv(name, "").strip()),
        "description": description,
    }


def build_synthesis_rollout_plan(environment: str) -> dict[str, Any]:
    env = environment.strip().lower()
    if env not in {"local", "staging", "production"}:
        raise ValueError("environment must be local, staging, or production")

    strategy = os.getenv("CODEFORGE_SYNTHESIS_PROVIDER", "auto").strip().lower() or "auto"

    openai_required = [
        _env_item("OPENAI_API_KEY", True, "API key for OpenAI-hosted synthesis"),
        _env_item("OPENAI_BASE_URL", False, "Optional base URL override for OpenAI-compatible gateways"),
        _env_item("CODEFORGE_SYNTHESIS_MODEL", False, "Model id used for synthesis"),
    ]

    azure_required = [
        _env_item("AZURE_OPENAI_ENDPOINT", True, "Azure OpenAI endpoint URL"),
        _env_item("AZURE_OPENAI_API_KEY", True, "Azure OpenAI API key"),
        _env_item("AZURE_OPENAI_DEPLOYMENT", True, "Azure model deployment name"),
        _env_item("AZURE_OPENAI_API_VERSION", False, "Azure OpenAI API version"),
    ]

    providers = [
        {
            "provider": "openai",
            "enabled": openai_required[0]["set"],
            "required_env": openai_required,
            "notes": [
                "Recommended for quickest rollout in local and staging.",
                "Use CODEFORGE_SYNTHESIS_MODEL to tune latency/cost tradeoffs.",
            ],
        },
        {
            "provider": "azure_openai",
            "enabled": all(item["set"] for item in azure_required[:3]),
            "required_env": azure_required,
            "notes": [
                "Recommended for production in Azure-hosted environments.",
                "Pin AZURE_OPENAI_API_VERSION for predictable deployment behavior.",
            ],
        },
    ]

    if env == "production":
        recommended = "azure_openai"
        automation_steps = [
            "Store synthesis secrets in managed secret store (Key Vault or equivalent).",
            "Inject secrets at deploy-time using CI/CD secret references, not plain env files.",
            "Set CODEFORGE_SYNTHESIS_PROVIDER=azure_openai and validate /api/v1/evals/synthesis-rollout.",
            "Enable deterministic fallback and monitor synthesis_source ratios in telemetry.",
        ]
    elif env == "staging":
        recommended = "openai"
        automation_steps = [
            "Set CODEFORGE_SYNTHESIS_PROVIDER=auto for failover testing.",
            "Inject staging secrets from CI/CD secret variables.",
            "Run smoke tests against /api/v1/evals/synthesis-rollout before promotion.",
        ]
    else:
        recommended = "openai"
        automation_steps = [
            "Use local .env for developer-only keys.",
            "Set CODEFORGE_SYNTHESIS_PROVIDER=auto to test provider fallback.",
            "Verify selected provider via /api/v1/evals/synthesis-rollout.",
        ]

    return {
        "environment": env,
        "strategy": strategy,
        "recommended_provider": recommended,
        "providers": providers,
        "automation_steps": automation_steps,
    }


def validate_synthesis_rollout(environment: str) -> dict[str, Any]:
    plan = build_synthesis_rollout_plan(environment)
    provider_readiness: list[dict[str, Any]] = []
    blockers: list[str] = []

    for provider in plan["providers"]:
        required_items = [item for item in provider["required_env"] if item["required"]]
        missing_required = [item["name"] for item in required_items if not item["set"]]
        ready = len(missing_required) == 0

        provider_readiness.append(
            {
                "provider": provider["provider"],
                "ready": ready,
                "required_count": len(required_items),
                "configured_count": len(required_items) - len(missing_required),
                "missing_required_env": missing_required,
            }
        )

    recommended_provider = plan["recommended_provider"]
    selected_provider = "deterministic"
    strategy = plan["strategy"]

    if strategy in {"openai", "azure_openai"}:
        selected_provider = strategy
    elif strategy == "auto":
        rec_ready = next((p for p in provider_readiness if p["provider"] == recommended_provider), None)
        if rec_ready and rec_ready["ready"]:
            selected_provider = recommended_provider
        else:
            fallback_ready = next((p for p in provider_readiness if p["provider"] == "openai" and p["ready"]), None)
            if fallback_ready:
                selected_provider = "openai"

    selected_readiness = next((p for p in provider_readiness if p["provider"] == selected_provider), None)
    is_ready_for_release = bool(selected_readiness and selected_readiness["ready"])

    if not is_ready_for_release:
        if selected_readiness:
            blockers.extend(
                [f"{selected_provider}: missing {name}" for name in selected_readiness["missing_required_env"]]
            )
        else:
            blockers.append("No configured synthesis provider is ready; deterministic fallback will be used")

    total_required = sum(item["required_count"] for item in provider_readiness)
    total_configured = sum(item["configured_count"] for item in provider_readiness)
    readiness_score = int((total_configured / total_required) * 100) if total_required else 100

    next_actions = list(plan["automation_steps"])
    if blockers:
        next_actions.append("Resolve missing required env vars for selected provider before promotion")

    return {
        "environment": plan["environment"],
        "strategy": strategy,
        "recommended_provider": recommended_provider,
        "selected_provider": selected_provider,
        "is_ready_for_release": is_ready_for_release,
        "readiness_score": readiness_score,
        "provider_readiness": provider_readiness,
        "blockers": blockers,
        "next_actions": next_actions,
    }
