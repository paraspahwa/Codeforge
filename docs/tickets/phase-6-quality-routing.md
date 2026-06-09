# Phase 6 - Quality and Routing

## Goal

Make the product evidence-backed, cost-bounded, and trustworthy.

## Status

- T6.1 DeepSeek-first routing: **done (API)** — keyword/heuristic intent classifier with tier-bound `model_for_tier()` policy (not a local Qwen model)
- T6.2 Sonnet and Opus fallback policy: **done (API)** — hard-debug → Sonnet, frontier → Opus; fallback paths force `review_required`
- T6.3 confidence messaging: **done (API + web + terminal + desktop Code + VS Code)** — stream payloads expose score/label/review/tier; all primary coding surfaces render routing confidence banners
- T6.4 evaluation and benchmarking: **partial** — routing benchmark suites with baseline/trend DB storage; SWE-bench-style `/api/v1/evals/quality-benchmark` (patch apply + verify fixtures) with **fail-closed** CI gate; routing regressions remain warnings only

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
