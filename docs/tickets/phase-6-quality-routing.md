# Phase 6 - Quality and Routing

## Goal

Make the product evidence-backed, cost-bounded, and trustworthy.

## Status

- T6.1 DeepSeek-first routing: done, routing now defaults to DeepSeek Flash/Pro tiers for low-cost majority traffic with observable routing metadata
- T6.2 Sonnet and Opus fallback policy: done, Sonnet fallback is used for hard-debug prompts and Opus fallback is reserved for explicit frontier-level prompts
- T6.3 confidence messaging: done, API responses and stream events now expose confidence score/label, review-required flags, and routing tier in UI-visible fields
- T6.4 evaluation and benchmarking: done, internal routing benchmark endpoint reports pass-rate, fallback usage, low-confidence rate, and per-case outcomes

## Tickets

### T6.1 - DeepSeek-first routing

- Prefer lower-cost model paths for the majority of requests.
- Escalate only when needed.
- Current state: route selection now explicitly prioritizes DeepSeek Flash/Pro, with escalation only for higher-risk intents.
- Acceptance: routing is cost-aware and observable.

### T6.2 - Sonnet and Opus fallback policy

- Keep Claude Sonnet for hard debugging.
- Reserve Opus for frontier or enterprise cases.
- Current state: hard-debug intent routes to Sonnet fallback while frontier intent routes to Opus fallback with explicit high-cost rationale.
- Acceptance: high-cost fallback usage is explicit and limited.

### T6.3 - Confidence messaging

- Surface low-confidence states clearly in the UI.
- Show when a human review is needed.
- Current state: message responses and run stream payloads include confidence score/label and review-required markers, and the web dashboard renders these signals.
- Acceptance: the user can tell when a result is tentative.

### T6.4 - Evaluation and benchmarking

- Add internal benchmarking against real repository tasks and SWE-bench-style sets.
- Track routing and quality regressions.
- Current state: `/api/v1/evals/routing-benchmark` runs representative routing cases and returns policy pass/fallback/confidence metrics with per-case detail.
- Acceptance: model policy is measurable and reviewable.
