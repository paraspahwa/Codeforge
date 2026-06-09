import hashlib
import hmac
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .agent import build_agent_run, get_synthesis_rollout_status, route_request, run_routing_benchmark, serialize_sse_event
from .agent_loop import run_verify_fix_loop
from .auth import AuthUser, dev_auth_enabled, get_current_user
from .context_mcp import ContextMcpError, context_mcp_service
from .cowork import CoworkError, cowork_service
from .routers import platform as platform_router
from .state import (
    RATE_LIMIT_PER_MINUTE,
    generation_client,
    redis_session_store,
    task_queue,
    vector_store,
)
from .deploy_ops import build_synthesis_rollout_plan
from .deploy_ops import validate_synthesis_rollout
from .projects_team import ProjectsTeamError, projects_team_service
from .db import (
    insert_cowork_reliability_snapshot,
    get_agent_proposal_for_user,
    list_agent_proposals_for_session,
    list_cowork_reliability_snapshots,
    get_routing_benchmark_baseline,
    get_usage_summary_for_user,
    get_session_for_user,
    get_user_subscription,
    init_db,
    insert_routing_benchmark_run,
    insert_agent_proposal,
    insert_billing_order,
    insert_billing_webhook,
    get_billing_webhook,
    insert_message,
    insert_session,
    insert_usage_log,
    latest_routing_benchmark_run,
    list_routing_benchmark_runs,
    latest_user_message,
    list_messages_for_session,
    list_sessions_for_user,
    upsert_routing_benchmark_baseline,
    update_agent_proposal_status,
    update_billing_order_status,
    upsert_user_subscription,
)
from .file_ops import apply_proposed_content
from .project_paths import normalize_project_path, resolved_project_path
from .usage_policy import get_usage_policy
from .workflow_ops import (
    build_compact_summary,
    build_ultrareview_audit,
    create_multi_file_plan,
    execute_multi_file_plan,
    rollback_multi_file_plan,
)
from .file_ops import read_file_content, read_file_excerpt, read_file_line_count, repo_relative_path, resolve_repo_path
from .git_ops import GitError, git_branch, git_commit, git_conflict_assisted_apply, git_conflict_resolution_guide, git_diff, git_log, git_merge_assist, git_stage, git_status, git_worktree_create, git_worktree_list
from .shell_ops import ShellError, prepare_shell_execution, stream_shell_execution
from .tracing import add_span_event, configure_tracing, current_trace_id, set_span_attributes, traced_span
from .models import (
    AgentLoopAttemptResponse,
    AgentLoopRequest,
    AgentLoopResponse,
    AgentProposal,
    CompactWorkflowResponse,
    BillingPlan,
    BillingWebhookResponse,
    CoworkExtractRequest,
    CoworkExtractionListResponse,
    CoworkExtractionResponse,
    CoworkReliabilityHistoryResponse,
    CoworkReliabilitySnapshotItem,
    CoworkJobCreateRequest,
    CoworkJobListResponse,
    CoworkJobResponse,
    CoworkJobToggleRequest,
    CoworkReliabilityResponse,
    CoworkPlanListResponse,
    CoworkPlanRequest,
    CoworkPlanResponse,
    CoworkRunListResponse,
    CoworkRunRequest,
    CoworkRunResponse,
    ContextPackAttachRequest,
    ContextPackCreateRequest,
    ContextPackListResponse,
    ContextPackResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    PlanCreateRequest,
    PlanExecuteRequest,
    PlanExecuteResponse,
    PlanExecuteResultItem,
    PlanResponse,
    PlanRollbackResponse,
    DevLoginRequest,
    DevLoginResponse,
    DeploymentRolloutPlanResponse,
    DeploymentRolloutValidationResponse,
    FileApplyRequest,
    FileApplyResponse,
    FileContentResponse,
    FilePreviewResponse,
    GitBranchRequest,
    GitBranchResponse,
    GitConflictAssistApplyRequest,
    GitConflictAssistApplyResponse,
    GitDiffResponse,
    GitCommitRequest,
    GitCommitResponse,
    GitConflictGuideResponse,
    GitLogResponse,
    GitMergeAssistResponse,
    GitStatusItem,
    GitStatusResponse,
    GitStageRequest,
    GitStageResponse,
    GitWorktreeCreateRequest,
    GitWorktreeCreateResponse,
    GitWorktreeListResponse,
    GitWorktreeItem,
    ProposalDecisionRequest,
    ProposalDecisionResponse,
    RoutingBenchmarkResponse,
    RoutingBenchmarkBaselineResponse,
    RoutingBenchmarkBaselineSetRequest,
    RoutingBenchmarkTrendItem,
    RoutingBenchmarkTrendResponse,
    SynthesisRolloutStatusResponse,
    ProjectKnowledgeQueryRequest,
    ProjectKnowledgeQueryResponse,
    ProjectKnowledgeRebuildRequest,
    ProjectKnowledgeResponse,
    MessageCreateRequest,
    MessageCreateResponse,
    MessageItem,
    McpConnectorCreateRequest,
    McpConnectorInvokeRequest,
    McpConnectorListResponse,
    McpConnectorResponse,
    McpConnectorToggleRequest,
    McpInvokeResponse,
    SessionExportResponse,
    SessionForkResponse,
    SessionShareCreateRequest,
    SessionShareResolveResponse,
    SessionShareResponse,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionListItem,
    ShellExecuteRequest,
    ShellExecuteResponse,
    SessionContextResponse,
    SubscriptionStatus,
    TeamDelegationCreateRequest,
    TeamDelegationListResponse,
    TeamDelegationResponse,
    TeamWorkspaceCreateRequest,
    TeamWorkspaceListResponse,
    TeamWorkspaceMemberRequest,
    TeamWorkspaceResponse,
    UltrareviewRequest,
    UltrareviewResponse,
    UsageSummary,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
    utc_now,
)

@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    configure_tracing(application)
    await cowork_service.start()

    redis_session_store.set("stack:last_startup", utc_now().isoformat(), ttl_seconds=3600)
    vector_store.upsert_text(
        item_id="stack_bootstrap",
        text="CodeForge startup heartbeat",
        metadata={"source": "startup"},
    )

    yield

    await cowork_service.stop()


app = FastAPI(title="CodeForge API", version="0.1.0", lifespan=lifespan)

def _enforce_rate_limit(scope: str, identity: str, limit: int) -> None:
    window = int(time.time() // 60)
    count = redis_session_store.incr_with_ttl(f"ratelimit:{scope}:{identity}:{window}", 120)
    if count > limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")

BILLING_PLANS = [
    BillingPlan(plan_id="lite", name="Lite", amount_inr=199, request_limit=300),
    BillingPlan(plan_id="pro", name="Pro", amount_inr=499, request_limit=1000),
    BillingPlan(plan_id="team", name="Team", amount_inr=1299, request_limit=2500),
]
def _parse_period_start(period_start: str) -> datetime:
    parsed = datetime.fromisoformat(period_start.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _attach_trace_id(response: Response) -> Response:
    trace_id = current_trace_id()
    if trace_id:
        response.headers["x-trace-id"] = trace_id
    return response


def _benchmark_regression_threshold() -> float:
    raw = os.getenv("CODEFORGE_BENCHMARK_REGRESSION_THRESHOLD", "0.05").strip()
    try:
        threshold = float(raw)
    except ValueError:
        threshold = 0.05
    return max(0.01, min(threshold, 0.5))


def _evaluate_benchmark_regression(
    result: dict[str, float | int | str | list[dict[str, object]]],
    baseline: dict[str, object] | None,
) -> tuple[bool, str]:
    if baseline is None:
        return False, ""

    threshold = _benchmark_regression_threshold()
    reasons: list[str] = []

    pass_drop = float(baseline.get("pass_rate", 0.0)) - float(result.get("pass_rate", 0.0))
    if pass_drop >= threshold:
        reasons.append(f"pass_rate dropped by {pass_drop:.3f}")

    fallback_increase = float(result.get("fallback_usage_rate", 0.0)) - float(baseline.get("fallback_usage_rate", 0.0))
    if fallback_increase >= threshold:
        reasons.append(f"fallback_usage_rate increased by {fallback_increase:.3f}")

    low_conf_increase = float(result.get("low_confidence_rate", 0.0)) - float(baseline.get("low_confidence_rate", 0.0))
    if low_conf_increase >= threshold:
        reasons.append(f"low_confidence_rate increased by {low_conf_increase:.3f}")

    if not reasons:
        return False, ""
    return True, "; ".join(reasons)

_cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CODEFORGE_CORS_ORIGINS",
        "http://localhost:3000,http://localhost:1420,tauri://localhost,http://tauri.localhost",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(platform_router.router)


@app.middleware("http")
async def attach_trace_id(request: Request, call_next):
    response = await call_next(request)
    trace_id = current_trace_id()
    if trace_id:
        response.headers["x-trace-id"] = trace_id
    return response


@app.post("/api/v1/auth/dev-login", response_model=DevLoginResponse)
def dev_login(payload: DevLoginRequest, request: Request) -> DevLoginResponse:
    if not dev_auth_enabled():
        raise HTTPException(status_code=404, detail="Not found")
    client_host = request.client.host if request.client else "unknown"
    _enforce_rate_limit("dev-login", client_host, 10)
    return DevLoginResponse(access_token=f"dev_{payload.user_id}")


@app.post("/api/v1/sessions", response_model=SessionCreateResponse)
def create_session(payload: SessionCreateRequest, response: Response, user: AuthUser = Depends(get_current_user)) -> SessionCreateResponse:
    _enforce_rate_limit("create-session", user.user_id, 20)
    session_id = f"sess_{uuid4().hex[:12]}"
    created_at = utc_now()

    insert_session(
        session_id=session_id,
        user_id=user.user_id,
        project_path=payload.project_path,
        model_preference=payload.model_preference,
        created_at=created_at.isoformat(),
    )

    _attach_trace_id(response)
    api_base = os.getenv("CODEFORGE_PUBLIC_API_BASE", "http://localhost:8000").rstrip("/")
    return SessionCreateResponse(
        session_id=session_id,
        stream_url=f"{api_base}/api/v1/sessions/{session_id}/stream",
        created_at=created_at,
    )


@app.post("/api/v1/sessions/{session_id}/fork", response_model=SessionForkResponse)
def fork_session(session_id: str, user: AuthUser = Depends(get_current_user)) -> SessionForkResponse:
    _enforce_rate_limit("fork-session", user.user_id, 20)
    parent = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if parent is None:
        raise HTTPException(status_code=404, detail="Session not found")

    new_session_id = f"sess_{uuid4().hex[:12]}"
    created_at = utc_now()
    insert_session(
        session_id=new_session_id,
        user_id=user.user_id,
        project_path=parent["project_path"],
        model_preference=parent["model_preference"],
        created_at=created_at.isoformat(),
    )
    api_base = os.getenv("CODEFORGE_PUBLIC_API_BASE", "http://localhost:8000").rstrip("/")
    return SessionForkResponse(
        session_id=new_session_id,
        parent_session_id=session_id,
        project_path=parent["project_path"],
        stream_url=f"{api_base}/api/v1/sessions/{new_session_id}/stream",
        created_at=created_at,
    )


@app.get("/api/v1/sessions", response_model=list[SessionListItem])
def list_sessions(
    user: AuthUser = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[SessionListItem]:
    rows = list_sessions_for_user(user.user_id, limit=limit, offset=offset)
    return [SessionListItem(**row) for row in rows]


@app.get("/api/v1/usage/summary", response_model=UsageSummary)
def usage_summary(user: AuthUser = Depends(get_current_user)) -> UsageSummary:
    plan_id, request_limit, requests_used, requests_remaining, period_start = get_usage_policy(user.user_id)
    summary = get_usage_summary_for_user(user.user_id, since_iso=period_start)
    return UsageSummary(
        **summary,
        plan_id=plan_id,
        request_limit=request_limit,
        requests_remaining=requests_remaining,
        billing_period_start=_parse_period_start(period_start),
        requests_used_in_period=requests_used,
    )


@app.get("/api/v1/billing/plans", response_model=list[BillingPlan])
def billing_plans() -> list[BillingPlan]:
    return BILLING_PLANS


@app.get("/api/v1/billing/subscription", response_model=SubscriptionStatus)
def billing_subscription(user: AuthUser = Depends(get_current_user)) -> SubscriptionStatus:
    subscription = get_user_subscription(user.user_id)
    if subscription is None:
        return SubscriptionStatus(
            user_id=user.user_id,
            plan_id="free",
            status="inactive",
            amount_inr=None,
            order_id=None,
            updated_at=utc_now(),
        )
    return SubscriptionStatus(**subscription)


@app.post("/api/v1/billing/create-order", response_model=CreateOrderResponse)
async def billing_create_order(
    payload: CreateOrderRequest,
    user: AuthUser = Depends(get_current_user),
) -> CreateOrderResponse:
    key_id = os.getenv("RAZORPAY_KEY_ID", "rzp_test_local")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    created_at = utc_now().isoformat()

    provider = "mock"
    order_id = f"order_mock_{uuid4().hex[:12]}"

    if key_secret:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.razorpay.com/v1/orders",
                auth=(key_id, key_secret),
                json={
                    "amount": payload.amount_inr * 100,
                    "currency": payload.currency,
                    "receipt": f"rcpt_{uuid4().hex[:10]}",
                    "notes": {
                        "plan_id": payload.plan_id,
                        "user_id": user.user_id,
                    },
                },
            )
            if response.is_success:
                provider = "razorpay"
                order_id = response.json().get("id", order_id)

    insert_billing_order(
        order_id=order_id,
        user_id=user.user_id,
        plan_id=payload.plan_id,
        amount_inr=payload.amount_inr,
        currency=payload.currency,
        provider=provider,
        status="created",
        created_at=created_at,
    )

    return CreateOrderResponse(
        order_id=order_id,
        amount_inr=payload.amount_inr,
        currency=payload.currency,
        key_id=key_id,
        provider=provider,
    )


@app.post("/api/v1/billing/verify-payment", response_model=VerifyPaymentResponse)
def billing_verify_payment(
    payload: VerifyPaymentRequest,
    user: AuthUser = Depends(get_current_user),
) -> VerifyPaymentResponse:
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    if key_secret:
        signing_payload = f"{payload.order_id}|{payload.payment_id}".encode("utf-8")
        expected = hmac.new(key_secret.encode("utf-8"), signing_payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, payload.signature):
            raise HTTPException(status_code=401, detail="Invalid payment signature")

    update_billing_order_status(payload.order_id, "paid")
    upsert_user_subscription(
        user_id=user.user_id,
        plan_id=payload.plan_id,
        status="active",
        amount_inr=payload.amount_inr,
        order_id=payload.order_id,
        updated_at=utc_now().isoformat(),
    )

    return VerifyPaymentResponse(
        status="verified",
        subscription_plan=payload.plan_id,
        order_id=payload.order_id,
    )


@app.post("/api/v1/billing/webhook", response_model=BillingWebhookResponse)
async def billing_webhook(request: Request) -> BillingWebhookResponse:
    payload_bytes = await request.body()
    payload_text = payload_bytes.decode("utf-8", errors="ignore")
    signature = request.headers.get("x-razorpay-signature", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    if key_secret:
        expected = hmac.new(key_secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = json.loads(payload_text or "{}")
    event_id = str(event.get("payload", {}).get("payment", {}).get("entity", {}).get("id") or uuid4().hex)
    event_type = str(event.get("event", "unknown"))

    if get_billing_webhook(f"evt_{event_id}") is not None:
        return BillingWebhookResponse(status="duplicate")

    try:
        insert_billing_webhook(
            event_id=f"evt_{event_id}",
            event_type=event_type,
            payload_json=payload_text,
            created_at=utc_now().isoformat(),
        )
    except Exception:
        # Concurrent retry inserted the same event between our check and insert.
        return BillingWebhookResponse(status="duplicate")

    return BillingWebhookResponse(status="received")


@app.post("/api/v1/sessions/{session_id}/messages", response_model=MessageCreateResponse)
def post_message(
    session_id: str,
    payload: MessageCreateRequest,
    response: Response,
    user: AuthUser = Depends(get_current_user),
) -> MessageCreateResponse:
    _enforce_rate_limit("messages", user.user_id, RATE_LIMIT_PER_MINUTE)
    with traced_span(
        "codeforge.session.post_message",
        {
            "codeforge.session_id": session_id,
            "codeforge.user_id": user.user_id,
        },
    ):
        session = get_session_for_user(session_id=session_id, user_id=user.user_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")

        plan_id, request_limit, _requests_used, requests_remaining, _period_start = get_usage_policy(user.user_id)
        set_span_attributes(
            {
                "codeforge.plan_id": plan_id,
                "codeforge.request_limit": request_limit,
                "codeforge.requests_remaining": requests_remaining,
            }
        )
        if requests_remaining <= 0:
            add_span_event("usage.limit_reached", {"plan_id": plan_id})
            raise HTTPException(status_code=429, detail=f"Request limit reached for {plan_id} plan")

        decision = route_request(payload.content)
        message_id = f"msg_{uuid4().hex[:12]}"
        input_tokens = max(1, len(payload.content.split()))
        output_tokens = max(6, input_tokens // 2)
        latency_ms = 120 + min(input_tokens * 3, 420)
        cost_usd = round((input_tokens * 0.0000012) + (output_tokens * 0.0000024), 6)

        set_span_attributes(
            {
                "codeforge.intent": decision.intent,
                "codeforge.model": decision.model_used,
                "codeforge.input_tokens": input_tokens,
                "codeforge.output_tokens": output_tokens,
                "codeforge.estimated_cost_usd": decision.estimated_cost_usd,
            }
        )
        add_span_event(
            "message.routed",
            {"intent": decision.intent, "model": decision.model_used},
        )

        created_at = utc_now().isoformat()
        insert_message(
            message_id=message_id,
            session_id=session_id,
            role="user",
            content=payload.content,
            context_json=json.dumps(payload.context.model_dump()) if payload.context else None,
            created_at=created_at,
        )

        insert_usage_log(
            usage_id=f"usage_{uuid4().hex[:12]}",
            user_id=user.user_id,
            session_id=session_id,
            model_used=decision.model_used,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            created_at=created_at,
        )
        add_span_event(
            "usage.logged",
            {"latency_ms": latency_ms, "cost_usd": cost_usd},
        )

        _attach_trace_id(response)
        return MessageCreateResponse(
            message_id=message_id,
            status="streaming",
            model_used=decision.model_used,
            estimated_cost=decision.estimated_cost_usd,
            intent=decision.intent,
            routing_reason=decision.reason,
            confidence_score=decision.confidence_score,
            confidence_label=decision.confidence_label,
            review_required=decision.review_required,
            routing_tier=decision.routing_tier,
            fallback_used=decision.fallback_used,
            synthesis_source="pending",
            request_limit=request_limit,
            requests_remaining=requests_remaining - 1,
        )


@app.get("/api/v1/evals/routing-benchmark", response_model=RoutingBenchmarkResponse)
def eval_routing_benchmark(
    suite: str = "policy",
    user: AuthUser = Depends(get_current_user),
) -> RoutingBenchmarkResponse:
    _ = user
    try:
        result = run_routing_benchmark(suite=suite)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    baseline = get_routing_benchmark_baseline(result["suite"])
    if baseline is None:
        created_at = utc_now().isoformat()
        upsert_routing_benchmark_baseline(
            suite=result["suite"],
            pass_rate=float(result["pass_rate"]),
            fallback_usage_rate=float(result["fallback_usage_rate"]),
            low_confidence_rate=float(result["low_confidence_rate"]),
            total_estimated_cost_usd=float(result["total_estimated_cost_usd"]),
            updated_at=created_at,
            updated_by="system:auto-initialized",
        )
        baseline = get_routing_benchmark_baseline(result["suite"])

    regression_alert, regression_reason = _evaluate_benchmark_regression(result, baseline)
    insert_routing_benchmark_run(
        run_id=f"bench_{uuid4().hex[:12]}",
        suite=str(result["suite"]),
        total_cases=int(result["total_cases"]),
        passed_cases=int(result["passed_cases"]),
        pass_rate=float(result["pass_rate"]),
        fallback_usage_rate=float(result["fallback_usage_rate"]),
        low_confidence_rate=float(result["low_confidence_rate"]),
        total_estimated_cost_usd=float(result["total_estimated_cost_usd"]),
        regression_alert=regression_alert,
        regression_reason=regression_reason,
        created_at=utc_now().isoformat(),
    )

    add_span_event(
        "eval.routing_benchmark",
        {
            "suite": result.get("suite", suite),
            "total_cases": result["total_cases"],
            "pass_rate": result["pass_rate"],
            "fallback_usage_rate": result["fallback_usage_rate"],
            "regression_alert": regression_alert,
            "regression_reason": regression_reason,
        },
    )
    return RoutingBenchmarkResponse(**result)


@app.get("/api/v1/evals/routing-benchmark/baseline", response_model=RoutingBenchmarkBaselineResponse)
def get_routing_benchmark_baseline_endpoint(
    suite: str = "policy",
    user: AuthUser = Depends(get_current_user),
) -> RoutingBenchmarkBaselineResponse:
    _ = user
    baseline = get_routing_benchmark_baseline(suite)
    if baseline is None:
        raise HTTPException(status_code=404, detail="Benchmark baseline not found")
    return RoutingBenchmarkBaselineResponse(**baseline)


@app.post("/api/v1/evals/routing-benchmark/baseline", response_model=RoutingBenchmarkBaselineResponse)
def set_routing_benchmark_baseline_endpoint(
    payload: RoutingBenchmarkBaselineSetRequest,
    user: AuthUser = Depends(get_current_user),
) -> RoutingBenchmarkBaselineResponse:
    latest = latest_routing_benchmark_run(payload.suite)
    if latest is None and any(
        value is None
        for value in (
            payload.pass_rate,
            payload.fallback_usage_rate,
            payload.low_confidence_rate,
            payload.total_estimated_cost_usd,
        )
    ):
        raise HTTPException(status_code=400, detail="No latest run available; provide full baseline metrics")

    pass_rate = payload.pass_rate if payload.pass_rate is not None else float(latest["pass_rate"])  # type: ignore[index]
    fallback_usage_rate = payload.fallback_usage_rate if payload.fallback_usage_rate is not None else float(latest["fallback_usage_rate"])  # type: ignore[index]
    low_confidence_rate = payload.low_confidence_rate if payload.low_confidence_rate is not None else float(latest["low_confidence_rate"])  # type: ignore[index]
    total_estimated_cost_usd = payload.total_estimated_cost_usd if payload.total_estimated_cost_usd is not None else float(latest["total_estimated_cost_usd"])  # type: ignore[index]

    updated_at = utc_now().isoformat()
    upsert_routing_benchmark_baseline(
        suite=payload.suite,
        pass_rate=float(pass_rate),
        fallback_usage_rate=float(fallback_usage_rate),
        low_confidence_rate=float(low_confidence_rate),
        total_estimated_cost_usd=float(total_estimated_cost_usd),
        updated_at=updated_at,
        updated_by=user.user_id,
    )
    baseline = get_routing_benchmark_baseline(payload.suite)
    if baseline is None:
        raise HTTPException(status_code=500, detail="Failed to persist benchmark baseline")
    return RoutingBenchmarkBaselineResponse(**baseline)


@app.get("/api/v1/evals/routing-benchmark/trends", response_model=RoutingBenchmarkTrendResponse)
def get_routing_benchmark_trends_endpoint(
    suite: str = "policy",
    limit: int = 20,
    user: AuthUser = Depends(get_current_user),
) -> RoutingBenchmarkTrendResponse:
    _ = user
    baseline = get_routing_benchmark_baseline(suite)
    runs = list_routing_benchmark_runs(suite=suite, limit=limit)
    trend_items = [RoutingBenchmarkTrendItem(**row) for row in runs]
    regression_alerts_last_10 = sum(1 for item in trend_items[:10] if item.regression_alert)
    return RoutingBenchmarkTrendResponse(
        suite=suite,
        baseline=RoutingBenchmarkBaselineResponse(**baseline) if baseline else None,
        runs=trend_items,
        regression_alerts_last_10=regression_alerts_last_10,
    )


@app.get("/api/v1/evals/synthesis-rollout", response_model=SynthesisRolloutStatusResponse)
def eval_synthesis_rollout(user: AuthUser = Depends(get_current_user)) -> SynthesisRolloutStatusResponse:
    _ = user
    status = get_synthesis_rollout_status()
    add_span_event(
        "eval.synthesis_rollout",
        {
            "strategy": status["strategy"],
            "selected_provider": status["selected_provider"],
        },
    )
    return SynthesisRolloutStatusResponse(**status)


@app.get("/api/v1/deploy/synthesis-rollout-plan", response_model=DeploymentRolloutPlanResponse)
def deploy_synthesis_rollout_plan(
    environment: str = "local",
    user: AuthUser = Depends(get_current_user),
) -> DeploymentRolloutPlanResponse:
    _ = user
    try:
        plan = build_synthesis_rollout_plan(environment)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DeploymentRolloutPlanResponse(**plan)


@app.get("/api/v1/deploy/synthesis-rollout-validate", response_model=DeploymentRolloutValidationResponse)
def deploy_synthesis_rollout_validate(
    environment: str = "local",
    user: AuthUser = Depends(get_current_user),
) -> DeploymentRolloutValidationResponse:
    _ = user
    try:
        validation = validate_synthesis_rollout(environment)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DeploymentRolloutValidationResponse(**validation)


@app.get("/api/v1/sessions/{session_id}/messages", response_model=list[MessageItem])
def list_messages(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[MessageItem]:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    rows = list_messages_for_session(session_id, limit=limit, offset=offset)
    return [MessageItem(**row) for row in rows]


def _session_project_path(session_id: str, user: AuthUser) -> str:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return resolved_project_path(session)


@app.get("/api/v1/sessions/{session_id}/files/preview", response_model=FilePreviewResponse)
def preview_session_file(
    session_id: str,
    path: str,
    user: AuthUser = Depends(get_current_user),
) -> FilePreviewResponse:
    project_path = _session_project_path(session_id, user)
    resolved = resolve_repo_path(project_path, path)
    if resolved is None:
        raise HTTPException(status_code=404, detail="File not found")

    relative_path = repo_relative_path(project_path, path) or path
    content = read_file_content(project_path, relative_path)
    return FilePreviewResponse(
        path=relative_path,
        exists=True,
        line_count=read_file_line_count(project_path, relative_path),
        excerpt=read_file_excerpt(project_path, relative_path),
        content=content,
    )


@app.get("/api/v1/sessions/{session_id}/files/content", response_model=FileContentResponse)
def session_file_content(
    session_id: str,
    path: str,
    user: AuthUser = Depends(get_current_user),
) -> FileContentResponse:
    project_path = _session_project_path(session_id, user)
    resolved = resolve_repo_path(project_path, path)
    if resolved is None:
        raise HTTPException(status_code=404, detail="File not found")

    relative_path = repo_relative_path(project_path, path) or path
    return FileContentResponse(
        path=relative_path,
        exists=True,
        content=read_file_content(project_path, relative_path),
    )


@app.post("/api/v1/sessions/{session_id}/files/apply", response_model=FileApplyResponse)
def apply_session_file(
    session_id: str,
    payload: FileApplyRequest,
    user: AuthUser = Depends(get_current_user),
) -> FileApplyResponse:
    project_path = _session_project_path(session_id, user)
    resolved = resolve_repo_path(project_path, payload.path)
    if resolved is None:
        raise HTTPException(status_code=404, detail="File not found")

    relative_path = repo_relative_path(project_path, payload.path) or payload.path
    applied = apply_proposed_content(project_path, relative_path, payload.content)
    if not applied:
        raise HTTPException(status_code=400, detail="Unable to apply file content")

    return FileApplyResponse(
        path=relative_path,
        applied=True,
        line_count=read_file_line_count(project_path, relative_path),
    )


@app.post("/api/v1/cowork/plans", response_model=CoworkPlanResponse)
def create_cowork_plan(payload: CoworkPlanRequest, user: AuthUser = Depends(get_current_user)) -> CoworkPlanResponse:
    session = get_session_for_user(session_id=payload.session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        plan = cowork_service.create_plan(
            user_id=user.user_id,
            session_id=payload.session_id,
            project_path=resolved_project_path(session),
            title=payload.title,
            task_type=payload.task_type,
            command=payload.command,
            source_path=payload.source_path,
            url=payload.url,
            browser_action=payload.browser_action,
        )
        add_span_event("cowork.plan_created", {"plan_id": plan["plan_id"], "task_type": plan["task_type"]})
    except CoworkError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CoworkPlanResponse(**plan)


@app.get("/api/v1/cowork/plans", response_model=CoworkPlanListResponse)
def list_cowork_plans(user: AuthUser = Depends(get_current_user)) -> CoworkPlanListResponse:
    plans = cowork_service.list_plans(user.user_id)
    return CoworkPlanListResponse(plans=[CoworkPlanResponse(**item) for item in plans])


@app.post("/api/v1/cowork/plans/{plan_id}/run", response_model=CoworkRunResponse)
async def run_cowork_plan(
    plan_id: str,
    payload: CoworkRunRequest,
    user: AuthUser = Depends(get_current_user),
) -> CoworkRunResponse:
    try:
        run = await cowork_service.run_plan(user_id=user.user_id, plan_id=plan_id, approved=payload.approved)
        add_span_event("cowork.plan_run", {"plan_id": plan_id, "status": run["status"]})
    except CoworkError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CoworkRunResponse(**run)


@app.get("/api/v1/cowork/runs", response_model=CoworkRunListResponse)
def list_cowork_runs(user: AuthUser = Depends(get_current_user)) -> CoworkRunListResponse:
    runs = cowork_service.list_runs(user.user_id)
    return CoworkRunListResponse(runs=[CoworkRunResponse(**item) for item in runs])


@app.post("/api/v1/cowork/jobs", response_model=CoworkJobResponse)
def create_cowork_job(payload: CoworkJobCreateRequest, user: AuthUser = Depends(get_current_user)) -> CoworkJobResponse:
    session = get_session_for_user(session_id=payload.session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        job = cowork_service.create_job(
            user_id=user.user_id,
            session_id=payload.session_id,
            project_path=resolved_project_path(session),
            title=payload.title,
            trigger_type=payload.trigger_type,
            interval_seconds=payload.interval_seconds,
            watch_path=payload.watch_path,
            task_type=payload.task_type,
            command=payload.command,
            source_path=payload.source_path,
            url=payload.url,
            browser_action=payload.browser_action,
        )
        add_span_event("cowork.job_created", {"job_id": job["job_id"], "trigger_type": job["trigger_type"]})
    except CoworkError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CoworkJobResponse(**job)


@app.get("/api/v1/cowork/jobs", response_model=CoworkJobListResponse)
def list_cowork_jobs(user: AuthUser = Depends(get_current_user)) -> CoworkJobListResponse:
    jobs = cowork_service.list_jobs(user.user_id)
    return CoworkJobListResponse(jobs=[CoworkJobResponse(**item) for item in jobs])


@app.post("/api/v1/cowork/jobs/{job_id}/toggle", response_model=CoworkJobResponse)
def toggle_cowork_job(
    job_id: str,
    payload: CoworkJobToggleRequest,
    user: AuthUser = Depends(get_current_user),
) -> CoworkJobResponse:
    try:
        job = cowork_service.toggle_job(user_id=user.user_id, job_id=job_id, enabled=payload.enabled)
    except CoworkError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return CoworkJobResponse(**job)


@app.post("/api/v1/cowork/extract", response_model=CoworkExtractionResponse)
async def extract_cowork_data(
    payload: CoworkExtractRequest,
    user: AuthUser = Depends(get_current_user),
) -> CoworkExtractionResponse:
    session = get_session_for_user(session_id=payload.session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        plan = cowork_service.create_plan(
            user_id=user.user_id,
            session_id=payload.session_id,
            project_path=resolved_project_path(session),
            title=f"Extract data from {payload.source_path}",
            task_type="extract",
            command=None,
            source_path=payload.source_path,
            url=None,
            browser_action=None,
        )
        run = await cowork_service.run_plan(user_id=user.user_id, plan_id=plan["plan_id"], approved=True)
    except CoworkError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    details = dict(run.get("details", {}))
    return CoworkExtractionResponse(**details)


@app.get("/api/v1/cowork/extract", response_model=CoworkExtractionListResponse)
def list_cowork_extractions(user: AuthUser = Depends(get_current_user)) -> CoworkExtractionListResponse:
    rows = cowork_service.list_extractions(user.user_id)
    return CoworkExtractionListResponse(extractions=[CoworkExtractionResponse(**row) for row in rows])


@app.get("/api/v1/cowork/reliability", response_model=CoworkReliabilityResponse)
def cowork_reliability_snapshot(user: AuthUser = Depends(get_current_user)) -> CoworkReliabilityResponse:
    _ = user
    snapshot = cowork_service.reliability_snapshot()
    snapshot_id = f"cwr_{uuid4().hex[:12]}"
    created_at = utc_now().isoformat()
    insert_cowork_reliability_snapshot(
        snapshot_id=snapshot_id,
        max_concurrent_runs=int(snapshot["max_concurrent_runs"]),
        running_jobs=int(snapshot["running_jobs"]),
        total_jobs=int(snapshot["total_jobs"]),
        enabled_jobs=int(snapshot["enabled_jobs"]),
        circuit_broken_jobs=int(snapshot["circuit_broken_jobs"]),
        recent_runs=int(snapshot["recent_runs"]),
        recent_failed_runs=int(snapshot["recent_failed_runs"]),
        recent_failure_rate=float(snapshot["recent_failure_rate"]),
        reliability_alert=bool(snapshot["reliability_alert"]),
        alert_reason=str(snapshot.get("alert_reason", "")),
        created_at=created_at,
    )
    return CoworkReliabilityResponse(**snapshot)


@app.get("/api/v1/cowork/reliability/history", response_model=CoworkReliabilityHistoryResponse)
def cowork_reliability_history(
    limit: int = 100,
    user: AuthUser = Depends(get_current_user),
) -> CoworkReliabilityHistoryResponse:
    _ = user
    rows = list_cowork_reliability_snapshots(limit=limit)
    return CoworkReliabilityHistoryResponse(snapshots=[CoworkReliabilitySnapshotItem(**row) for row in rows])


@app.post("/api/v1/projects/knowledge/rebuild", response_model=ProjectKnowledgeResponse)
def rebuild_project_knowledge(
    payload: ProjectKnowledgeRebuildRequest,
    user: AuthUser = Depends(get_current_user),
) -> ProjectKnowledgeResponse:
    session = get_session_for_user(session_id=payload.session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        state = projects_team_service.rebuild_knowledge(
            user_id=user.user_id,
            session_id=payload.session_id,
            project_path=resolved_project_path(session),
            title=payload.title,
        )
    except ProjectsTeamError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    add_span_event("projects.knowledge_rebuilt", {"session_id": payload.session_id, "knowledge_id": state["knowledge_id"]})

    # Persist indexed knowledge excerpts in vector store for semantic retrieval.
    for item in state.get("items", []):
        path = str(item.get("path", ""))
        excerpt = str(item.get("excerpt", ""))
        if not path or not excerpt:
            continue
        vector_store.upsert_text(
            item_id=f"kb:{state['knowledge_id']}:{path}",
            text=excerpt,
            metadata={
                "kind": "knowledge_item",
                "knowledge_id": state["knowledge_id"],
                "session_id": payload.session_id,
                "path": path,
            },
        )

    return ProjectKnowledgeResponse(**state)


@app.get("/api/v1/projects/knowledge", response_model=ProjectKnowledgeResponse)
def get_project_knowledge(session_id: str, user: AuthUser = Depends(get_current_user)) -> ProjectKnowledgeResponse:
    try:
        state = projects_team_service.get_knowledge(user_id=user.user_id, session_id=session_id)
    except ProjectsTeamError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ProjectKnowledgeResponse(**state)


@app.post("/api/v1/projects/knowledge/query", response_model=ProjectKnowledgeQueryResponse)
def query_project_knowledge(
    payload: ProjectKnowledgeQueryRequest,
    user: AuthUser = Depends(get_current_user),
) -> ProjectKnowledgeQueryResponse:
    try:
        result = projects_team_service.query_knowledge(
            user_id=user.user_id,
            session_id=payload.session_id,
            query=payload.query,
            limit=payload.limit,
        )
    except ProjectsTeamError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    vector_hits = vector_store.search_text(
        query=payload.query,
        limit=payload.limit,
    )
    lexical_results = list(result.get("results", []))
    existing_paths = {str(item.get("path", "")) for item in lexical_results}

    for hit in vector_hits:
        payload_data = hit.get("payload", {}) if isinstance(hit, dict) else {}
        path = str(payload_data.get("path", "semantic_match"))
        excerpt = str(payload_data.get("text") or payload_data.get("excerpt") or "")
        if not excerpt:
            continue

        if path in existing_paths:
            continue

        lexical_results.append(
            {
                "path": path,
                "excerpt": excerpt,
                "score": max(1, int(float(hit.get("score", 0.0)) * 100)),
            }
        )

    lexical_results.sort(key=lambda item: int(item.get("score", 0)), reverse=True)
    result["results"] = lexical_results[: payload.limit]
    result["summary"] = (
        f"Returned {len(result['results'])} result(s) with lexical + vector retrieval "
        f"(embedding_source={vector_store.embedding_source})."
    )

    return ProjectKnowledgeQueryResponse(**result)


@app.post("/api/v1/team/workspaces", response_model=TeamWorkspaceResponse)
def create_team_workspace(
    payload: TeamWorkspaceCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> TeamWorkspaceResponse:
    workspace = projects_team_service.create_workspace(
        owner_id=user.user_id,
        name=payload.name,
        description=payload.description,
    )
    add_span_event("team.workspace_created", {"workspace_id": workspace["workspace_id"]})
    return TeamWorkspaceResponse(**workspace)


@app.get("/api/v1/team/workspaces", response_model=TeamWorkspaceListResponse)
def list_team_workspaces(user: AuthUser = Depends(get_current_user)) -> TeamWorkspaceListResponse:
    workspaces = projects_team_service.list_workspaces(user_id=user.user_id)
    return TeamWorkspaceListResponse(workspaces=[TeamWorkspaceResponse(**item) for item in workspaces])


@app.post("/api/v1/team/workspaces/{workspace_id}/members", response_model=TeamWorkspaceResponse)
def add_team_workspace_member(
    workspace_id: str,
    payload: TeamWorkspaceMemberRequest,
    user: AuthUser = Depends(get_current_user),
) -> TeamWorkspaceResponse:
    try:
        workspace = projects_team_service.add_workspace_member(
            actor_id=user.user_id,
            workspace_id=workspace_id,
            member_user_id=payload.user_id,
            role=payload.role,
        )
    except ProjectsTeamError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TeamWorkspaceResponse(**workspace)


@app.post("/api/v1/team/session-share", response_model=SessionShareResponse)
def create_session_share(
    payload: SessionShareCreateRequest,
    request: Request,
    user: AuthUser = Depends(get_current_user),
) -> SessionShareResponse:
    session = get_session_for_user(session_id=payload.session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    share = projects_team_service.create_session_share(
        user_id=user.user_id,
        session_id=payload.session_id,
        access_level=payload.access_level,
        expires_in_hours=payload.expires_in_hours,
    )
    base_url = str(request.base_url).rstrip("/")
    response_payload = dict(share)
    response_payload["share_url"] = f"{base_url}/api/v1/team/session-share/{share['share_id']}"
    return SessionShareResponse(**response_payload)


@app.get("/api/v1/team/session-share/{share_id}", response_model=SessionShareResolveResponse)
def resolve_session_share(share_id: str, user: AuthUser = Depends(get_current_user)) -> SessionShareResolveResponse:
    _ = user
    try:
        share = projects_team_service.resolve_session_share(share_id=share_id)
    except ProjectsTeamError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    session = get_session_for_user(session_id=share["session_id"], user_id=share["owner_id"])
    if session is None:
        raise HTTPException(status_code=404, detail="Shared session not found")

    return SessionShareResolveResponse(
        share_id=share["share_id"],
        session_id=share["session_id"],
        owner_id=share["owner_id"],
        access_level=share["access_level"],
        project_path=resolved_project_path(session),
        model_preference=session["model_preference"],
        expires_at=share["expires_at"],
    )


@app.get("/api/v1/team/session-export/{session_id}", response_model=SessionExportResponse)
def export_session(
    session_id: str,
    format: str = "json",
    user: AuthUser = Depends(get_current_user),
) -> SessionExportResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    rows = list_messages_for_session(session_id, limit=1000)
    if format == "markdown":
        lines = [f"# Session {session_id}", ""]
        for row in rows:
            role = str(row["role"]).capitalize()
            lines.append(f"## {role}")
            lines.append(str(row["content"]))
            lines.append("")
        content = "\n".join(lines).strip()
        return SessionExportResponse(session_id=session_id, format="markdown", content=content)

    content = json.dumps({"session_id": session_id, "messages": rows}, indent=2)
    return SessionExportResponse(session_id=session_id, format="json", content=content)


@app.post("/api/v1/team/delegations", response_model=TeamDelegationResponse)
def create_team_delegation(
    payload: TeamDelegationCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> TeamDelegationResponse:
    session = get_session_for_user(session_id=payload.session_id, user_id=user.user_id)
    if session is None:
        owner_session = None
        for workspace in projects_team_service.list_workspaces(user_id=user.user_id):
            owner_session = get_session_for_user(session_id=payload.session_id, user_id=workspace["owner_id"])
            if owner_session:
                break
        if owner_session is None:
            raise HTTPException(status_code=404, detail="Session not found")

    try:
        delegation = projects_team_service.create_delegation(
            requester_id=user.user_id,
            workspace_id=payload.workspace_id,
            session_id=payload.session_id,
            assigned_role=payload.assigned_role,
            task=payload.task,
            priority=payload.priority,
        )
    except ProjectsTeamError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TeamDelegationResponse(**delegation)


@app.get("/api/v1/team/delegations", response_model=TeamDelegationListResponse)
def list_team_delegations(
    workspace_id: str | None = None,
    user: AuthUser = Depends(get_current_user),
) -> TeamDelegationListResponse:
    items = projects_team_service.list_delegations(user_id=user.user_id, workspace_id=workspace_id)
    return TeamDelegationListResponse(delegations=[TeamDelegationResponse(**item) for item in items])


@app.post("/api/v1/context/packs", response_model=ContextPackResponse)
def create_context_pack(
    payload: ContextPackCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> ContextPackResponse:
    if payload.session_id:
        session = get_session_for_user(session_id=payload.session_id, user_id=user.user_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")

    try:
        pack = context_mcp_service.create_pack(
            user_id=user.user_id,
            session_id=payload.session_id,
            title=payload.title,
            summary=payload.summary,
            tags=payload.tags,
            snippets=payload.snippets,
        )
    except ContextMcpError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    add_span_event("context.pack_created", {"pack_id": pack["pack_id"]})

    for index, snippet in enumerate(pack.get("snippets", []), start=1):
        vector_store.upsert_text(
            item_id=f"ctx:{pack['pack_id']}:{index}",
            text=snippet,
            metadata={
                "kind": "context_snippet",
                "pack_id": pack["pack_id"],
                "session_id": pack.get("session_id"),
                "title": pack.get("title", "Context pack"),
                "snippet": snippet,
            },
        )

    return ContextPackResponse(**pack)


@app.get("/api/v1/context/packs", response_model=ContextPackListResponse)
def list_context_packs(
    session_id: str | None = None,
    user: AuthUser = Depends(get_current_user),
) -> ContextPackListResponse:
    if session_id:
        session = get_session_for_user(session_id=session_id, user_id=user.user_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")

    packs = context_mcp_service.list_packs(user_id=user.user_id, session_id=session_id)
    return ContextPackListResponse(packs=[ContextPackResponse(**item) for item in packs])


@app.post("/api/v1/context/attach", response_model=ContextPackResponse)
def attach_context_pack(
    payload: ContextPackAttachRequest,
    user: AuthUser = Depends(get_current_user),
) -> ContextPackResponse:
    session = get_session_for_user(session_id=payload.session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        pack = context_mcp_service.attach_pack(
            user_id=user.user_id,
            session_id=payload.session_id,
            pack_id=payload.pack_id,
        )
    except ContextMcpError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ContextPackResponse(**pack)


@app.get("/api/v1/context/session/{session_id}", response_model=SessionContextResponse)
def get_session_context(session_id: str, user: AuthUser = Depends(get_current_user)) -> SessionContextResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    context = context_mcp_service.compose_session_context(user_id=user.user_id, session_id=session_id)
    seed_query = latest_user_message(session_id)
    if seed_query:
        vector_hits = vector_store.search_text(seed_query, limit=3)
        snippets = list(context.get("snippets", []))
        for hit in vector_hits:
            payload_data = hit.get("payload", {}) if isinstance(hit, dict) else {}
            snippet_text = str(payload_data.get("snippet") or payload_data.get("text") or "").strip()
            if not snippet_text:
                continue
            snippets.append(
                {
                    "pack_id": str(payload_data.get("pack_id", "vector")),
                    "title": str(payload_data.get("title", "Semantic retrieval")),
                    "snippet": snippet_text,
                }
            )

        context["snippets"] = snippets[:6]
        context["summary"] = (
            f"Loaded {len(context['snippets'])} context snippet(s) including semantic retrieval "
            f"(embedding_source={vector_store.embedding_source})"
        )
        context["composed_text"] = "\n".join(
            f"[{row['title']}] {row['snippet']}" for row in context["snippets"]
        )

    return SessionContextResponse(**context)


@app.post("/api/v1/mcp/connectors", response_model=McpConnectorResponse)
def create_mcp_connector(
    payload: McpConnectorCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> McpConnectorResponse:
    try:
        connector = context_mcp_service.register_connector(
            user_id=user.user_id,
            name=payload.name,
            description=payload.description,
            endpoint=payload.endpoint,
            transport=payload.transport,
            tools=payload.tools,
        )
    except ContextMcpError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    add_span_event("mcp.connector_created", {"connector_id": connector["connector_id"]})
    return McpConnectorResponse(**connector)


@app.get("/api/v1/mcp/connectors", response_model=McpConnectorListResponse)
def list_mcp_connectors(user: AuthUser = Depends(get_current_user)) -> McpConnectorListResponse:
    connectors = context_mcp_service.list_connectors(user_id=user.user_id)
    return McpConnectorListResponse(connectors=[McpConnectorResponse(**item) for item in connectors])


@app.post("/api/v1/mcp/connectors/{connector_id}/toggle", response_model=McpConnectorResponse)
def toggle_mcp_connector(
    connector_id: str,
    payload: McpConnectorToggleRequest,
    user: AuthUser = Depends(get_current_user),
) -> McpConnectorResponse:
    try:
        connector = context_mcp_service.toggle_connector(
            user_id=user.user_id,
            connector_id=connector_id,
            enabled=payload.enabled,
        )
    except ContextMcpError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return McpConnectorResponse(**connector)


@app.post("/api/v1/mcp/connectors/{connector_id}/invoke", response_model=McpInvokeResponse)
def invoke_mcp_connector(
    connector_id: str,
    payload: McpConnectorInvokeRequest,
    user: AuthUser = Depends(get_current_user),
) -> McpInvokeResponse:
    try:
        result = context_mcp_service.invoke_connector(
            user_id=user.user_id,
            connector_id=connector_id,
            tool_name=payload.tool_name,
            arguments=payload.arguments,
        )
    except ContextMcpError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    add_span_event("mcp.connector_invoked", {"connector_id": connector_id, "tool_name": payload.tool_name})
    return McpInvokeResponse(**result)


@app.get("/api/v1/sessions/{session_id}/git/status", response_model=GitStatusResponse)
def session_git_status(session_id: str, user: AuthUser = Depends(get_current_user)) -> GitStatusResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        status = git_status(resolved_project_path(session))
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitStatusResponse(
        branch=status["branch"],
        clean=status["clean"],
        changed_files=[GitStatusItem(**item) for item in status["changed_files"]],
        untracked_files=status["untracked_files"],
        summary=status["summary"],
    )


@app.get("/api/v1/sessions/{session_id}/git/diff", response_model=GitDiffResponse)
def session_git_diff(
    session_id: str,
    path: str | None = None,
    user: AuthUser = Depends(get_current_user),
) -> GitDiffResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        diff = git_diff(resolved_project_path(session), path)
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitDiffResponse(**diff)


@app.get("/api/v1/sessions/{session_id}/git/log", response_model=GitLogResponse)
def session_git_log(
    session_id: str,
    limit: int = 10,
    user: AuthUser = Depends(get_current_user),
) -> GitLogResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        log = git_log(resolved_project_path(session), limit=limit)
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitLogResponse(**log)


@app.post("/api/v1/sessions/{session_id}/git/stage", response_model=GitStageResponse)
def session_git_stage(
    session_id: str,
    payload: GitStageRequest,
    user: AuthUser = Depends(get_current_user),
) -> GitStageResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        stage = git_stage(resolved_project_path(session), payload.paths, payload.all_files)
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitStageResponse(**stage)


@app.post("/api/v1/sessions/{session_id}/git/commit", response_model=GitCommitResponse)
def session_git_commit(
    session_id: str,
    payload: GitCommitRequest,
    user: AuthUser = Depends(get_current_user),
) -> GitCommitResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        commit = git_commit(resolved_project_path(session), payload.message)
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitCommitResponse(**commit)


@app.post("/api/v1/sessions/{session_id}/git/branch", response_model=GitBranchResponse)
def session_git_branch(
    session_id: str,
    payload: GitBranchRequest,
    user: AuthUser = Depends(get_current_user),
) -> GitBranchResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        branch = git_branch(resolved_project_path(session), payload.branch, create=payload.create)
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitBranchResponse(**branch)


@app.get("/api/v1/sessions/{session_id}/git/worktree/list", response_model=GitWorktreeListResponse)
def session_git_worktree_list(session_id: str, user: AuthUser = Depends(get_current_user)) -> GitWorktreeListResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = git_worktree_list(resolved_project_path(session))
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitWorktreeListResponse(worktrees=[GitWorktreeItem(**item) for item in result["worktrees"]])


@app.post("/api/v1/sessions/{session_id}/git/worktree/create", response_model=GitWorktreeCreateResponse)
def session_git_worktree_create(
    session_id: str,
    payload: GitWorktreeCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> GitWorktreeCreateResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = git_worktree_create(resolved_project_path(session), payload.branch)
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitWorktreeCreateResponse(**result)


@app.get("/api/v1/sessions/{session_id}/git/merge-assist", response_model=GitMergeAssistResponse)
def session_git_merge_assist(
    session_id: str,
    target_branch: str,
    user: AuthUser = Depends(get_current_user),
) -> GitMergeAssistResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = git_merge_assist(resolved_project_path(session), target_branch)
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitMergeAssistResponse(**result)


@app.get("/api/v1/sessions/{session_id}/git/conflict-guide", response_model=GitConflictGuideResponse)
def session_git_conflict_guide(
    session_id: str,
    target_branch: str,
    user: AuthUser = Depends(get_current_user),
) -> GitConflictGuideResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = git_conflict_resolution_guide(resolved_project_path(session), target_branch)
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitConflictGuideResponse(**result)


@app.post("/api/v1/sessions/{session_id}/git/conflict-assist/apply", response_model=GitConflictAssistApplyResponse)
def session_git_conflict_assist_apply(
    session_id: str,
    payload: GitConflictAssistApplyRequest,
    user: AuthUser = Depends(get_current_user),
) -> GitConflictAssistApplyResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = git_conflict_assisted_apply(
            project_path=resolved_project_path(session),
            target_branch=payload.target_branch,
            strategy=payload.strategy,
            paths=payload.paths,
        )
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GitConflictAssistApplyResponse(**result)


@app.post("/api/v1/sessions/{session_id}/shell/stream")
async def session_shell_stream(
    session_id: str,
    payload: ShellExecuteRequest,
    user: AuthUser = Depends(get_current_user),
) -> StreamingResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    set_span_attributes(
        {
            "codeforge.session_id": session_id,
            "codeforge.user_id": user.user_id,
            "codeforge.shell.command": payload.command,
        }
    )

    try:
        # Validate up front so blocked commands fail before the stream starts.
        prepare_shell_execution(resolved_project_path(session), payload.command)
    except ShellError as exc:
        add_span_event("shell.validation_failed", {"error": str(exc)})
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def event_generator():
        sequence = 0
        add_span_event("shell.stream_opened", {"command": payload.command})
        async for event in stream_shell_execution(
            resolved_project_path(session),
            payload.command,
            timeout_seconds=payload.timeout_seconds,
        ):
            yield serialize_sse_event(
                event_type=event["type"],
                payload=event["payload"],
                sequence=sequence,
            )
            sequence += 1

    return _attach_trace_id(StreamingResponse(event_generator(), media_type="text/event-stream"))


@app.post("/api/v1/sessions/{session_id}/workflows/compact", response_model=CompactWorkflowResponse)
def session_workflow_compact(session_id: str, user: AuthUser = Depends(get_current_user)) -> CompactWorkflowResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    result = build_compact_summary(
        session_id=session_id,
        project_path=resolved_project_path(session),
        user_id=user.user_id,
    )
    return CompactWorkflowResponse(**result)


@app.post("/api/v1/sessions/{session_id}/workflows/ultrareview", response_model=UltrareviewResponse)
def session_workflow_ultrareview(
    session_id: str,
    payload: UltrareviewRequest = UltrareviewRequest(),
    user: AuthUser = Depends(get_current_user),
) -> UltrareviewResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    result = build_ultrareview_audit(
        session_id=session_id,
        project_path=resolved_project_path(session),
        user_id=user.user_id,
        target_file=payload.target_file,
    )
    return UltrareviewResponse(**result)


@app.post("/api/v1/sessions/{session_id}/workflows/plan", response_model=PlanResponse)
def session_workflow_create_plan(
    session_id: str,
    payload: PlanCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> PlanResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = create_multi_file_plan(
            session_id=session_id,
            user_id=user.user_id,
            project_path=resolved_project_path(session),
            targets=payload.targets,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return PlanResponse(
        plan_id=result["plan_id"],
        session_id=result["session_id"],
        targets=result["targets"],
        status=result["status"],
        created_at=datetime.fromisoformat(result["created_at"].replace("Z", "+00:00")),
    )


@app.post("/api/v1/sessions/{session_id}/workflows/plan/{plan_id}/execute", response_model=PlanExecuteResponse)
async def session_workflow_execute_plan(
    session_id: str,
    plan_id: str,
    payload: PlanExecuteRequest,
    user: AuthUser = Depends(get_current_user),
) -> PlanExecuteResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await execute_multi_file_plan(
        plan_id=plan_id,
        session_id=session_id,
        user_id=user.user_id,
        project_path=resolved_project_path(session),
        prompt=payload.prompt,
        auto_mode=payload.auto_mode,
    )
    return PlanExecuteResponse(
        plan_id=result["plan_id"],
        status=result["status"],
        applied=[PlanExecuteResultItem(**item) for item in result["applied"]],
        message=result["message"],
        rolled_back_paths=result.get("rolled_back_paths", []),
    )


@app.post("/api/v1/sessions/{session_id}/workflows/plan/{plan_id}/rollback", response_model=PlanRollbackResponse)
def session_workflow_rollback_plan(
    session_id: str,
    plan_id: str,
    user: AuthUser = Depends(get_current_user),
) -> PlanRollbackResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = rollback_multi_file_plan(
            plan_id=plan_id,
            session_id=session_id,
            user_id=user.user_id,
            project_path=resolved_project_path(session),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return PlanRollbackResponse(**result)


@app.post("/api/v1/sessions/{session_id}/agent/loop", response_model=AgentLoopResponse)
async def session_agent_loop(
    session_id: str,
    payload: AgentLoopRequest,
    user: AuthUser = Depends(get_current_user),
) -> AgentLoopResponse:
    _enforce_rate_limit("agent-loop", user.user_id, RATE_LIMIT_PER_MINUTE)
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    plan_id, request_limit, _requests_used, requests_remaining, _period_start = get_usage_policy(user.user_id)
    if requests_remaining <= 0:
        raise HTTPException(status_code=429, detail=f"Request limit reached for {plan_id} plan")

    project_path = resolved_project_path(session)
    result = await run_verify_fix_loop(
        session_id=session_id,
        user_id=user.user_id,
        project_path=project_path,
        verify_command=payload.verify_command,
        fix_prompt=payload.prompt,
        max_attempts=payload.max_attempts,
        auto_apply=payload.auto_apply,
        auto_mode=payload.auto_mode,
        current_file=payload.current_file,
    )

    return AgentLoopResponse(
        session_id=result.session_id,
        passed=result.passed,
        message=result.message,
        attempts=[AgentLoopAttemptResponse(**attempt.__dict__) for attempt in result.attempts],
    )


@app.get("/api/v1/sessions/{session_id}/stream")
async def stream_session(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
) -> StreamingResponse:
    _enforce_rate_limit("stream", user.user_id, RATE_LIMIT_PER_MINUTE)
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator():
        with traced_span(
            "codeforge.session.stream_run",
            {
                "codeforge.session_id": session_id,
                "codeforge.user_id": user.user_id,
            },
        ):
            user_prompt = latest_user_message(session_id)
            session_context = context_mcp_service.compose_session_context(user_id=user.user_id, session_id=session_id)
            composed_prompt = user_prompt
            if session_context.get("composed_text"):
                composed_prompt = f"{user_prompt}\n\nAttached context:\n{session_context['composed_text']}"
            run = await build_agent_run(
                prompt=composed_prompt,
                session_id=session_id,
                project_path=resolved_project_path(session) if session else None,
                current_file=None,
            )
            trace_id = current_trace_id()
            set_span_attributes(
                {
                    "codeforge.intent": run.intent,
                    "codeforge.model": run.model_used,
                    "codeforge.target_file": run.target_file,
                }
            )
            proposal_id = f"prop_{uuid4().hex[:12]}"
            insert_agent_proposal(
                proposal_id=proposal_id,
                session_id=session_id,
                user_id=user.user_id,
                target_file=run.target_file,
                prompt=user_prompt,
                original_content=run.original_content,
                proposed_content=run.proposed_content,
                patch_preview=run.patch_preview,
                status="pending",
                created_at=utc_now().isoformat(),
            )
            add_span_event("proposal.created", {"proposal_id": proposal_id})

            yield serialize_sse_event(
                event_type="run_started",
                payload={
                    "session_id": session_id,
                    "model": run.model_used,
                    "intent": run.intent,
                    "reason": run.events[0].payload.get("reason") if run.events else None,
                    "proposal_id": proposal_id,
                    "synthesis_source": run.synthesis_source,
                    "confidence_score": run.confidence_score,
                    "confidence_label": run.confidence_label,
                    "review_required": run.review_required,
                    "routing_tier": run.routing_tier,
                    "fallback_used": run.fallback_used,
                    "trace_id": trace_id,
                },
                sequence=0,
            )

            for index, token in enumerate(run.token_chunks, start=1):
                payload = {"content": token, "model": run.model_used, "trace_id": trace_id}
                yield serialize_sse_event("token", payload, index)

            insert_message(
                message_id=f"msg_{uuid4().hex[:12]}",
                session_id=session_id,
                role="assistant",
                content=run.assistant_message,
                context_json=None,
                created_at=utc_now().isoformat(),
            )
            add_span_event("assistant.message_persisted", {"proposal_id": proposal_id})

            for offset, event in enumerate(run.events, start=len(run.token_chunks) + 1):
                payload = dict(event.payload)
                payload["trace_id"] = trace_id
                if event.type in {"diff", "approval_request"}:
                    payload["proposal_id"] = proposal_id
                yield serialize_sse_event(event.type, payload, offset, event.timestamp)

            yield serialize_sse_event(
                event_type="complete",
                payload={
                    "session_id": session_id,
                    "proposal_id": proposal_id,
                    "model": run.model_used,
                    "intent": run.intent,
                    "estimated_cost_usd": run.estimated_cost_usd,
                    "reason": run.events[-1].payload.get("reason") if run.events else None,
                    "input_tokens": run.input_tokens,
                    "output_tokens": run.output_tokens,
                    "synthesis_source": run.synthesis_source,
                    "confidence_score": run.confidence_score,
                    "confidence_label": run.confidence_label,
                    "review_required": run.review_required,
                    "routing_tier": run.routing_tier,
                    "fallback_used": run.fallback_used,
                    "trace_id": trace_id,
                },
                sequence=len(run.token_chunks) + len(run.events) + 1,
            )

    return _attach_trace_id(StreamingResponse(event_generator(), media_type="text/event-stream"))


@app.get("/api/v1/sessions/{session_id}/proposals", response_model=list[AgentProposal])
def list_proposals(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AgentProposal]:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    rows = list_agent_proposals_for_session(session_id=session_id, user_id=user.user_id, limit=limit)
    return [AgentProposal(**row) for row in rows]


@app.get("/api/v1/sessions/{session_id}/proposals/{proposal_id}", response_model=AgentProposal)
def get_proposal(session_id: str, proposal_id: str, user: AuthUser = Depends(get_current_user)) -> AgentProposal:
    proposal = get_agent_proposal_for_user(proposal_id=proposal_id, session_id=session_id, user_id=user.user_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return AgentProposal(**proposal)


@app.post("/api/v1/sessions/{session_id}/proposals/{proposal_id}/decision", response_model=ProposalDecisionResponse)
def decide_proposal(
    session_id: str,
    proposal_id: str,
    payload: ProposalDecisionRequest,
    user: AuthUser = Depends(get_current_user),
) -> ProposalDecisionResponse:
    session = get_session_for_user(session_id=session_id, user_id=user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    proposal = get_agent_proposal_for_user(proposal_id=proposal_id, session_id=session_id, user_id=user.user_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal["status"] != "pending":
        raise HTTPException(status_code=409, detail="Proposal already resolved")

    resolved_at = utc_now().isoformat()
    applied = False
    next_status = "rejected"
    note = None

    if payload.action == "approve":
        if proposal["original_content"] == proposal["proposed_content"]:
            raise HTTPException(status_code=400, detail="Proposal does not contain an applicable change")
        applied = apply_proposed_content(
            resolved_project_path(session),
            proposal["target_file"],
            proposal["proposed_content"],
        )
        if not applied:
            raise HTTPException(status_code=400, detail="Unable to apply proposal safely")
        next_status = "approved"
        note = "Applied to workspace"
    else:
        note = "Rejected by user"

    update_agent_proposal_status(
        proposal_id=proposal_id,
        status=next_status,
        resolved_at=resolved_at,
        resolution_note=note,
    )

    return ProposalDecisionResponse(
        proposal_id=proposal_id,
        session_id=session_id,
        status=next_status,
        target_file=proposal["target_file"],
        applied=applied,
        resolved_at=utc_now(),
    )
