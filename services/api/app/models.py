from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    project_path: str
    model_preference: str = "auto"


class SessionCreateResponse(BaseModel):
    session_id: str
    stream_url: str
    created_at: datetime


class SessionListItem(BaseModel):
    session_id: str
    project_path: str
    model_preference: str
    created_at: datetime


class MessageContext(BaseModel):
    current_file: str | None = None
    line_number: int | None = None


class AgentEvent(BaseModel):
    type: Literal[
        "run_started",
        "token",
        "tool_call",
        "tool_result",
        "diff",
        "approval_request",
        "shell_call",
        "shell_output",
        "shell_result",
        "complete",
        "raw",
    ]
    sequence: int
    timestamp: datetime
    payload: dict[str, Any] = Field(default_factory=dict)


class AgentProposal(BaseModel):
    proposal_id: str
    session_id: str
    user_id: str
    target_file: str
    prompt: str
    patch_preview: str
    status: str
    created_at: datetime
    resolved_at: datetime | None = None


class ProposalDecisionRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")


class ProposalDecisionResponse(BaseModel):
    proposal_id: str
    session_id: str
    status: str
    target_file: str
    applied: bool
    resolved_at: datetime


class FilePreviewResponse(BaseModel):
    path: str
    exists: bool
    line_count: int
    excerpt: str
    content: str


class FileContentResponse(BaseModel):
    path: str
    exists: bool
    content: str


class FileApplyRequest(BaseModel):
    path: str
    content: str = Field(min_length=0)


class FileApplyResponse(BaseModel):
    path: str
    applied: bool
    line_count: int


class GitStatusItem(BaseModel):
    status: str
    path: str


class GitStatusResponse(BaseModel):
    branch: str
    clean: bool
    changed_files: list[GitStatusItem]
    untracked_files: list[str]
    summary: str


class GitDiffResponse(BaseModel):
    path: str | None = None
    stat: str
    diff: str


class GitLogItem(BaseModel):
    commit_id: str
    message: str


class GitLogResponse(BaseModel):
    commits: list[GitLogItem]


class GitStageRequest(BaseModel):
    paths: list[str] = Field(default_factory=list)
    all_files: bool = False


class GitStageResponse(BaseModel):
    staged: bool
    paths: list[str]
    output: str


class GitCommitRequest(BaseModel):
    message: str = Field(min_length=1)


class GitCommitResponse(BaseModel):
    committed: bool
    message: str
    staged_files: list[str] = []
    output: str


class GitBranchRequest(BaseModel):
    branch: str = Field(min_length=1)
    create: bool = True


class GitBranchResponse(BaseModel):
    branch: str
    created: bool
    output: str


class GitWorktreeItem(BaseModel):
    path: str
    branch: str | None = None
    locked: bool = False
    prunable: bool = False


class GitWorktreeListResponse(BaseModel):
    worktrees: list[GitWorktreeItem]


class GitWorktreeCreateRequest(BaseModel):
    branch: str = Field(min_length=1)


class GitWorktreeCreateResponse(BaseModel):
    branch: str
    path: str
    created: bool
    output: str


class GitMergeAssistResponse(BaseModel):
    current_branch: str
    target_branch: str
    base_branch: str
    ahead_behind: str
    stat: str
    changed_files: list[str]
    conflicts: bool
    conflict_files: list[str] = []
    risk_level: Literal["low", "medium", "high"] = "low"
    can_auto_merge: bool = False
    safety_recommendations: list[str] = []
    conflict_preview: str
    merge_preview: str


class GitConflictGuideStep(BaseModel):
    title: str
    command: str
    reason: str


class GitConflictGuideResponse(BaseModel):
    current_branch: str
    target_branch: str
    conflict_files: list[str] = []
    has_conflicts: bool
    steps: list[GitConflictGuideStep]
    notes: list[str] = []


class GitConflictAssistApplyRequest(BaseModel):
    target_branch: str = Field(min_length=1)
    strategy: Literal["ours", "theirs"]
    paths: list[str] = Field(default_factory=list)


class GitConflictAssistApplyResponse(BaseModel):
    current_branch: str
    target_branch: str
    strategy: str
    applied_paths: list[str]
    remaining_conflicts: list[str] = []
    next_steps: list[str] = []


class ShellExecuteRequest(BaseModel):
    command: str = Field(min_length=1)
    timeout_seconds: int = Field(default=30, ge=1, le=120)


class ShellExecuteResponse(BaseModel):
    command: str
    cwd: str
    exit_code: int
    timed_out: bool
    output_lines: int


class MessageCreateRequest(BaseModel):
    content: str = Field(min_length=1)
    context: MessageContext | None = None


class MessageCreateResponse(BaseModel):
    message_id: str
    status: str
    model_used: str
    estimated_cost: float
    intent: str
    routing_reason: str
    confidence_score: float
    confidence_label: str
    review_required: bool
    routing_tier: str
    fallback_used: bool
    synthesis_source: str = "deterministic"
    request_limit: int
    requests_remaining: int


class MessageItem(BaseModel):
    message_id: str
    role: str
    content: str
    created_at: datetime


class UsageSummary(BaseModel):
    total_requests: int
    input_tokens: int
    output_tokens: int
    total_cost_usd: float
    avg_latency_ms: float
    plan_id: str
    request_limit: int
    requests_remaining: int
    billing_period_start: datetime
    requests_used_in_period: int


class AgentLoopRequest(BaseModel):
    verify_command: str = Field(min_length=1)
    prompt: str | None = None
    max_attempts: int = Field(default=3, ge=1, le=10)
    auto_apply: bool = True
    auto_mode: bool = False
    current_file: str | None = None


class AgentLoopAttemptResponse(BaseModel):
    attempt: int
    verify_passed: bool
    verify_exit_code: int
    verify_summary: str
    proposal_id: str | None = None
    applied: bool = False
    target_file: str | None = None
    patch_source: str | None = None


class AgentLoopResponse(BaseModel):
    session_id: str
    passed: bool
    message: str
    attempts: list[AgentLoopAttemptResponse]


class CompactWorkflowResponse(BaseModel):
    session_id: str
    summary: str
    message_count: int
    proposal_count: int


class UltrareviewFindingItem(BaseModel):
    severity: str
    message: str


class UltrareviewResponse(BaseModel):
    session_id: str
    risk_level: str
    findings: list[UltrareviewFindingItem]
    suggested_checks: list[str]
    report: str


class PlanCreateRequest(BaseModel):
    targets: list[str] = Field(min_length=1)


class PlanResponse(BaseModel):
    plan_id: str
    session_id: str
    targets: list[str]
    status: str
    created_at: datetime


class PlanExecuteRequest(BaseModel):
    prompt: str | None = None
    auto_mode: bool = False


class PlanExecuteResultItem(BaseModel):
    target: str
    proposal_id: str | None = None
    applied: bool = False
    review_required: bool = False
    confidence_label: str = ""


class PlanExecuteResponse(BaseModel):
    plan_id: str
    status: str
    applied: list[PlanExecuteResultItem]
    message: str
    rolled_back_paths: list[str] = Field(default_factory=list)


class PlanRollbackResponse(BaseModel):
    plan_id: str
    restored_paths: list[str]
    message: str


class UltrareviewRequest(BaseModel):
    target_file: str | None = None


class SessionForkResponse(BaseModel):
    session_id: str
    parent_session_id: str
    project_path: str
    stream_url: str
    created_at: datetime


class BillingPlan(BaseModel):
    plan_id: str
    name: str
    amount_inr: int
    request_limit: int


class CreateOrderRequest(BaseModel):
    plan_id: str
    amount_inr: int = Field(gt=0)
    currency: str = "INR"


class CreateOrderResponse(BaseModel):
    order_id: str
    amount_inr: int
    currency: str
    key_id: str
    provider: str


class VerifyPaymentRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str
    plan_id: str
    amount_inr: int


class VerifyPaymentResponse(BaseModel):
    status: str
    subscription_plan: str
    order_id: str


class SubscriptionStatus(BaseModel):
    user_id: str
    plan_id: str
    status: str
    amount_inr: int | None = None
    order_id: str | None = None
    updated_at: datetime


class BillingWebhookResponse(BaseModel):
    status: str


class DevLoginRequest(BaseModel):
    user_id: str = Field(min_length=2)


class DevLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SessionState(BaseModel):
    session_id: str
    project_path: str
    model_preference: str
    created_at: datetime
    messages: list[dict[str, Any]]


class CoworkPlanRequest(BaseModel):
    session_id: str
    title: str = ""
    task_type: Literal["shell", "extract", "browser", "connector"]
    command: str | None = None
    source_path: str | None = None
    url: str | None = None
    browser_action: Literal["capture_title", "extract_links"] = "capture_title"
    connector_id: str | None = None
    tool_name: str | None = None
    connector_arguments: dict[str, Any] = Field(default_factory=dict)


class CoworkPlanResponse(BaseModel):
    plan_id: str
    session_id: str
    title: str
    task_type: str
    command: str | None = None
    source_path: str | None = None
    url: str | None = None
    browser_action: str | None = None
    connector_id: str | None = None
    tool_name: str | None = None
    connector_arguments: dict[str, Any] = Field(default_factory=dict)
    requires_approval: bool
    preview_steps: list[str]
    status: str
    created_at: datetime


class CoworkRunRequest(BaseModel):
    approved: bool = False


class CoworkRunResponse(BaseModel):
    run_id: str
    plan_id: str
    task_type: str
    status: str
    summary: str
    details: dict[str, Any] = Field(default_factory=dict)
    trigger: str
    created_at: datetime
    completed_at: datetime | None = None


class CoworkPlanListResponse(BaseModel):
    plans: list[CoworkPlanResponse]


class CoworkRunListResponse(BaseModel):
    runs: list[CoworkRunResponse]


class CoworkJobCreateRequest(BaseModel):
    session_id: str
    title: str = ""
    trigger_type: Literal["interval", "file_change"]
    interval_seconds: int = Field(default=30, ge=5, le=3600)
    watch_path: str | None = None
    task_type: Literal["shell", "extract"]
    command: str | None = None
    source_path: str | None = None
    url: str | None = None
    browser_action: Literal["capture_title", "extract_links"] = "capture_title"


class CoworkJobToggleRequest(BaseModel):
    enabled: bool


class CoworkJobResponse(BaseModel):
    job_id: str
    title: str
    session_id: str
    trigger_type: str
    interval_seconds: int
    watch_path: str | None = None
    task_type: str
    command: str | None = None
    source_path: str | None = None
    url: str | None = None
    browser_action: str | None = None
    enabled: bool
    next_run_at: datetime | None = None
    last_run_at: datetime | None = None
    last_status: str
    created_at: datetime


class CoworkJobListResponse(BaseModel):
    jobs: list[CoworkJobResponse]


class CoworkExtractRequest(BaseModel):
    session_id: str
    source_path: str


class CoworkExtractionResponse(BaseModel):
    extraction_id: str
    source_path: str
    method: str
    byte_size: int
    text_excerpt: str
    entities: list[dict[str, str]] = []
    warnings: list[str] = []
    created_at: datetime


class CoworkExtractionListResponse(BaseModel):
    extractions: list[CoworkExtractionResponse]


class ProjectKnowledgeRebuildRequest(BaseModel):
    session_id: str
    title: str = ""


class ProjectKnowledgeItem(BaseModel):
    path: str
    excerpt: str
    indexed_at: datetime


class ProjectKnowledgeResponse(BaseModel):
    knowledge_id: str
    session_id: str
    title: str
    project_path: str
    summary: str
    items: list[ProjectKnowledgeItem]
    updated_at: datetime


class ProjectKnowledgeQueryRequest(BaseModel):
    session_id: str
    query: str = Field(min_length=1)
    limit: int = Field(default=6, ge=1, le=20)


class ProjectKnowledgeQueryItem(BaseModel):
    path: str
    excerpt: str
    score: int


class ProjectKnowledgeQueryResponse(BaseModel):
    knowledge_id: str
    query: str
    summary: str
    results: list[ProjectKnowledgeQueryItem]


class ProjectKnowledgeUploadResponse(BaseModel):
    knowledge_id: str
    session_id: str
    title: str
    project_path: str
    summary: str
    uploaded_paths: list[str]
    items: list[ProjectKnowledgeItem]
    updated_at: datetime


class TeamAuditLogEntry(BaseModel):
    event_id: str
    actor_id: str
    event_type: str
    resource_type: str
    resource_id: str
    workspace_id: str | None = None
    session_id: str | None = None
    metadata: dict[str, object] = {}
    created_at: datetime


class TeamAuditLogListResponse(BaseModel):
    events: list[TeamAuditLogEntry]


class TeamWorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=2)
    description: str = ""


class TeamWorkspaceMemberRequest(BaseModel):
    user_id: str = Field(min_length=2)
    role: Literal["admin", "member", "viewer"] = "member"


class TeamWorkspaceMemberItem(BaseModel):
    user_id: str
    role: str
    added_at: datetime


class TeamWorkspaceResponse(BaseModel):
    workspace_id: str
    name: str
    description: str
    owner_id: str
    created_at: datetime
    members: list[TeamWorkspaceMemberItem]


class TeamWorkspaceListResponse(BaseModel):
    workspaces: list[TeamWorkspaceResponse]


class SessionShareCreateRequest(BaseModel):
    session_id: str
    access_level: Literal["view", "comment"] = "view"
    expires_in_hours: int = Field(default=72, ge=1, le=720)


class SessionShareResponse(BaseModel):
    share_id: str
    session_id: str
    owner_id: str
    access_level: str
    share_url: str
    created_at: datetime
    expires_at: datetime


class SessionShareResolveResponse(BaseModel):
    share_id: str
    session_id: str
    owner_id: str
    access_level: str
    project_path: str
    model_preference: str
    expires_at: datetime


class SessionExportResponse(BaseModel):
    session_id: str
    format: Literal["json", "markdown"]
    content: str


class TeamDelegationCreateRequest(BaseModel):
    workspace_id: str
    session_id: str
    assigned_role: str = Field(min_length=2)
    task: str = Field(min_length=4)
    priority: Literal["low", "normal", "high"] = "normal"


class TeamDelegationResponse(BaseModel):
    task_id: str
    workspace_id: str
    session_id: str
    requester_id: str
    assigned_role: str
    task: str
    priority: str
    status: str
    note: str
    created_at: datetime


class TeamDelegationListResponse(BaseModel):
    delegations: list[TeamDelegationResponse]


class ContextPackCreateRequest(BaseModel):
    session_id: str | None = None
    title: str = ""
    summary: str = ""
    tags: list[str] = []
    snippets: list[str] = Field(default_factory=list, min_length=1)


class ContextPackAttachRequest(BaseModel):
    session_id: str
    pack_id: str


class ContextSnippetItem(BaseModel):
    pack_id: str
    title: str
    snippet: str


class ContextPackResponse(BaseModel):
    pack_id: str
    owner_id: str
    session_id: str | None = None
    title: str
    summary: str
    tags: list[str] = []
    snippets: list[str] = []
    attached_sessions: list[str] = []
    created_at: datetime
    updated_at: datetime


class ContextPackListResponse(BaseModel):
    packs: list[ContextPackResponse]


class SessionContextResponse(BaseModel):
    session_id: str
    summary: str
    snippets: list[ContextSnippetItem]
    composed_text: str


class McpConnectorCreateRequest(BaseModel):
    name: str = Field(min_length=2)
    description: str = ""
    endpoint: str = Field(min_length=3)
    transport: Literal["stdio", "http", "websocket"] = "http"
    tools: list[str] = Field(default_factory=list, min_length=1)


class McpConnectorToggleRequest(BaseModel):
    enabled: bool


class McpConnectorInvokeRequest(BaseModel):
    tool_name: str = Field(min_length=1)
    arguments: dict[str, Any] = Field(default_factory=dict)


class McpConnectorResponse(BaseModel):
    connector_id: str
    owner_id: str
    name: str
    description: str
    endpoint: str
    transport: str
    tools: list[str] = []
    enabled: bool
    last_result: str
    created_at: datetime
    updated_at: datetime


class McpConnectorListResponse(BaseModel):
    connectors: list[McpConnectorResponse]


class McpInvokeResponse(BaseModel):
    connector_id: str
    tool_name: str
    result: dict[str, Any] = Field(default_factory=dict)
    invoked_at: datetime


class RoutingBenchmarkCaseResult(BaseModel):
    prompt: str
    expected_intent: str
    actual_intent: str
    expected_tier: str
    actual_tier: str
    model: str
    fallback_used: bool
    confidence_score: float
    passed: bool


class RoutingBenchmarkResponse(BaseModel):
    suite: str = "policy"
    total_cases: int
    passed_cases: int
    pass_rate: float
    fallback_usage_rate: float
    low_confidence_rate: float
    total_estimated_cost_usd: float
    results: list[RoutingBenchmarkCaseResult]


class RoutingBenchmarkBaselineSetRequest(BaseModel):
    suite: Literal["policy", "repository", "all"] = "policy"
    pass_rate: float | None = None
    fallback_usage_rate: float | None = None
    low_confidence_rate: float | None = None
    total_estimated_cost_usd: float | None = None


class RoutingBenchmarkBaselineResponse(BaseModel):
    suite: str
    pass_rate: float
    fallback_usage_rate: float
    low_confidence_rate: float
    total_estimated_cost_usd: float
    updated_at: datetime
    updated_by: str


class RoutingBenchmarkTrendItem(BaseModel):
    run_id: str
    suite: str
    total_cases: int
    passed_cases: int
    pass_rate: float
    fallback_usage_rate: float
    low_confidence_rate: float
    total_estimated_cost_usd: float
    regression_alert: bool
    regression_reason: str = ""
    created_at: datetime


class RoutingBenchmarkTrendResponse(BaseModel):
    suite: str
    baseline: RoutingBenchmarkBaselineResponse | None = None
    runs: list[RoutingBenchmarkTrendItem]
    regression_alerts_last_10: int


class QualityBenchmarkCaseResult(BaseModel):
    task_id: str
    description: str
    target_file: str
    patch_applied: bool
    verify_command: str
    verify_exit_code: int
    passed: bool
    summary: str


class QualityBenchmarkResponse(BaseModel):
    suite: str = "swe-fixtures"
    total_cases: int
    passed_cases: int
    pass_rate: float
    fallback_usage_rate: float = 0.0
    low_confidence_rate: float = 0.0
    total_estimated_cost_usd: float = 0.0
    regression_alert: bool = False
    regression_reason: str = ""
    results: list[QualityBenchmarkCaseResult]


class QualityBenchmarkBaselineSetRequest(BaseModel):
    suite: Literal["swe-fixtures"] = "swe-fixtures"
    pass_rate: float | None = None
    fallback_usage_rate: float | None = None
    low_confidence_rate: float | None = None
    total_estimated_cost_usd: float | None = None


class SynthesisProviderStatus(BaseModel):
    provider: str
    configured: bool
    selected: bool
    model: str = ""
    endpoint: str = ""


class SynthesisRolloutStatusResponse(BaseModel):
    strategy: str
    selected_provider: str
    fallback_strategy: str
    providers: list[SynthesisProviderStatus]


class DeploymentRolloutEnvItem(BaseModel):
    name: str
    required: bool
    set: bool
    description: str


class DeploymentRolloutProviderPlan(BaseModel):
    provider: str
    enabled: bool
    required_env: list[DeploymentRolloutEnvItem]
    notes: list[str] = []


class DeploymentRolloutPlanResponse(BaseModel):
    environment: Literal["local", "staging", "production"]
    strategy: str
    recommended_provider: str
    providers: list[DeploymentRolloutProviderPlan]
    automation_steps: list[str] = []


class DeploymentRolloutProviderReadiness(BaseModel):
    provider: str
    ready: bool
    required_count: int
    configured_count: int
    missing_required_env: list[str] = []


class DeploymentRolloutValidationResponse(BaseModel):
    environment: Literal["local", "staging", "production"]
    strategy: str
    recommended_provider: str
    selected_provider: str
    is_ready_for_release: bool
    readiness_score: int
    provider_readiness: list[DeploymentRolloutProviderReadiness]
    blockers: list[str] = []
    next_actions: list[str] = []


class CoworkReliabilityResponse(BaseModel):
    max_concurrent_runs: int
    running_jobs: int
    total_jobs: int
    enabled_jobs: int
    circuit_broken_jobs: int
    recent_runs: int
    recent_failed_runs: int
    recent_failure_rate: float
    reliability_alert: bool
    alert_reason: str = ""


class CoworkReliabilitySnapshotItem(BaseModel):
    snapshot_id: str
    max_concurrent_runs: int
    running_jobs: int
    total_jobs: int
    enabled_jobs: int
    circuit_broken_jobs: int
    recent_runs: int
    recent_failed_runs: int
    recent_failure_rate: float
    reliability_alert: bool
    alert_reason: str = ""
    created_at: datetime


class CoworkReliabilityHistoryResponse(BaseModel):
    snapshots: list[CoworkReliabilitySnapshotItem]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
