"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatSessionListLabel } from "@codeforge/shared/sessions";

import {
  applyGitConflictAssist,
  compactWorkflow,
  createAgentTemplate,
  createSession,
  createWorkflowPlan,
  decideProposal,
  executeWorkflowPlan,
  fetchSessionArtifactPreviewHtml,
  forkSession,
  listAgentTemplates,
  listSessionArtifacts,
  getGitConflictGuide,
  getProposal,
  getUsageSummary,
  listMessages,
  listSessions,
  rollbackWorkflowPlan,
  runAgentLoop,
  sendMessage,
  streamSession,
  ultrareviewWorkflow,
} from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../lib/toast-context";

export default function ChatPage() {
  const { token, ready } = useAuth();
  const toast = useToast();

  const [projectPath, setProjectPath] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastModel, setLastModel] = useState("-");
  const [usage, setUsage] = useState(null);
  const [agentEvents, setAgentEvents] = useState([]);
  const [pendingProposal, setPendingProposal] = useState(null);
  const [showConflictTool, setShowConflictTool] = useState(false);
  const [conflictTargetBranch, setConflictTargetBranch] = useState("main");
  const [conflictGuide, setConflictGuide] = useState(null);
  const [conflictStrategy, setConflictStrategy] = useState("ours");
  const [conflictPaths, setConflictPaths] = useState("");
  const [conflictApplyResult, setConflictApplyResult] = useState(null);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [planTargets, setPlanTargets] = useState("");
  const [activePlanId, setActivePlanId] = useState("");
  const [workflowOutput, setWorkflowOutput] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [loopVerify, setLoopVerify] = useState("pytest -q");
  const [loopPrompt, setLoopPrompt] = useState("Fix verification failures with minimal safe edits.");
  const [loopMaxAttempts, setLoopMaxAttempts] = useState(3);
  const [loopRunning, setLoopRunning] = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [artifactPreviewHtml, setArtifactPreviewHtml] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("Code reviewer");
  const [templatePrefix, setTemplatePrefix] = useState(
    "You are a senior reviewer. Focus on correctness, security, and test coverage.",
  );
  const chatEndRef = useRef(null);
  const streamRef = useRef(null);

  const canSend = useMemo(
    () => Boolean(token && sessionId && prompt.trim() && !loading),
    [token, sessionId, prompt, loading]
  );

  useEffect(() => {
    setProjectPath(localStorage.getItem("codeforge_project_path") || "");
  }, []);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    listSessions(token)
      .then((sessions) => setSessionHistory(sessions))
      .catch((error) => toast.push(error.message));
    getUsageSummary(token)
      .then(setUsage)
      .catch(() => undefined);

    const resumeSessionId = localStorage.getItem("codeforge_resume_session");
    if (resumeSessionId) {
      localStorage.removeItem("codeforge_resume_session");
      listMessages(resumeSessionId, token)
        .then((stored) => {
          setSessionId(resumeSessionId);
          setMessages(
            stored.map((msg) => ({ id: msg.message_id, role: msg.role, content: msg.content })),
          );
          setAgentEvents([]);
          setPendingProposal(null);
          toast.push(`Resumed session ${resumeSessionId}`, "success");
        })
        .catch((error) => toast.push(error.message));
    }
    // toast is stable; refresh only when auth changes
    listAgentTemplates(token)
      .then((result) => setTemplates(result.templates || []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  useEffect(() => {
    if (!token || !sessionId) {
      setArtifacts([]);
      setSelectedArtifactId("");
      setArtifactPreviewHtml("");
      return;
    }
    listSessionArtifacts(sessionId, token)
      .then((result) => setArtifacts(result.artifacts || []))
      .catch(() => undefined);
  }, [token, sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => streamRef.current?.close(), []);

  async function refreshSessions() {
    const sessions = await listSessions(token);
    setSessionHistory(sessions);
  }

  async function handleCreateSession() {
    if (!projectPath.trim()) {
      toast.push("Set a project path first");
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem("codeforge_project_path", projectPath.trim());
      const result = await createSession(projectPath.trim(), token);
      setSessionId(result.session_id);
      setMessages([]);
      setAgentEvents([]);
      setPendingProposal(null);
      await refreshSessions();
      toast.push(`Session ${result.session_id} created`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSession(nextSessionId) {
    setLoading(true);
    try {
      const stored = await listMessages(nextSessionId, token);
      setSessionId(nextSessionId);
      setMessages(
        stored.map((msg) => ({ id: msg.message_id, role: msg.role, content: msg.content }))
      );
      setAgentEvents([]);
      setPendingProposal(null);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  function pushAgentEvents(entries) {
    setAgentEvents((prev) => [...entries.filter(Boolean), ...prev].slice(0, 12));
  }

  async function handleSendPrompt(event) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const userText = prompt.trim();
    setPrompt("");
    setLoading(true);

    const assistantId = `a_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", content: userText },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const sent = await sendMessage(sessionId, userText, token, null, selectedTemplateId || null);
      setLastModel(sent.model_used ?? "-");
      pushAgentEvents([
        `route: ${sent.intent ?? "unknown"} via ${sent.model_used ?? "unknown"}`,
        sent.routing_reason ? `why: ${sent.routing_reason}` : null,
        `confidence: ${sent.confidence_label ?? "unknown"} (${Math.round((sent.confidence_score ?? 0) * 100)}%)`,
        sent.review_required ? "review: human review recommended" : null,
      ]);

      const source = streamSession(sessionId, token, (evt) => {
        if (evt.type === "run_started") {
          pushAgentEvents([
            `run: ${evt.payload?.intent ?? "unknown"} via ${evt.payload?.model ?? "unknown"}`,
            evt.payload?.reason ? `why: ${evt.payload.reason}` : null,
            evt.payload?.confidence_label
              ? `confidence: ${evt.payload.confidence_label} (${Math.round((evt.payload.confidence_score ?? 0) * 100)}%)`
              : null,
            evt.payload?.review_required ? "review: human review recommended" : null,
            evt.payload?.routing_tier ? `tier: ${evt.payload.routing_tier}` : null,
            evt.payload?.fallback_used ? "route: fallback model path" : null,
          ]);
        }

        if (evt.type === "token") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + (evt.payload?.content ?? evt.content ?? "") }
                : msg
            )
          );
        }

        if (evt.type === "tool_call") {
          pushAgentEvents([`tool: ${evt.payload?.tool} (${evt.payload?.status})`]);
        }

        if (evt.type === "diff") {
          pushAgentEvents([`diff: ${evt.payload?.file}`]);
          if (evt.payload?.proposal_id) {
            setPendingProposal({
              proposal_id: evt.payload.proposal_id,
              target_file: evt.payload.file,
              patch_preview: evt.payload.patch,
              status: "pending",
            });
          }
        }

        if (evt.type === "approval_request") {
          pushAgentEvents([`approval: ${evt.payload?.message}`]);
          if (evt.payload?.proposal_id) {
            getProposal(sessionId, evt.payload.proposal_id, token)
              .then(setPendingProposal)
              .catch(() => undefined);
          }
        }

        if (evt.type === "tool_result") {
          pushAgentEvents([`verify: ${evt.payload?.message}`]);
        }

        if (evt.type === "complete") {
          pushAgentEvents([
            evt.payload?.confidence_label
              ? `final confidence: ${evt.payload.confidence_label} (${Math.round((evt.payload.confidence_score ?? 0) * 100)}%)`
              : null,
            evt.payload?.review_required ? "final review: human review recommended" : null,
            evt.payload?.artifact_ids?.length ? `artifacts: ${evt.payload.artifact_ids.join(", ")}` : null,
          ]);
          source.close();
          getUsageSummary(token).then(setUsage).catch(() => undefined);
          listSessionArtifacts(sessionId, token)
            .then((result) => setArtifacts(result.artifacts || []))
            .catch(() => undefined);
          setLoading(false);
        }
      });
      streamRef.current = source;

      source.onerror = () => {
        source.close();
        toast.push("Streaming connection lost");
        setLoading(false);
      };
    } catch (error) {
      toast.push(error.message);
      setLoading(false);
    }
  }

  async function handleProposalDecision(action) {
    if (!pendingProposal?.proposal_id) {
      return;
    }
    setLoading(true);
    try {
      const result = await decideProposal(sessionId, pendingProposal.proposal_id, action, token);
      setPendingProposal((prev) => (prev ? { ...prev, status: result.status } : prev));
      pushAgentEvents([`proposal ${result.status}: ${result.target_file}`]);
      if (action === "approve") {
        const stored = await listMessages(sessionId, token);
        setMessages(
          stored.map((msg) => ({ id: msg.message_id, role: msg.role, content: msg.content }))
        );
      }
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadConflictGuide() {
    if (!conflictTargetBranch.trim()) {
      toast.push("Target branch is required");
      return;
    }
    setLoading(true);
    try {
      const guide = await getGitConflictGuide(token, sessionId, conflictTargetBranch.trim());
      setConflictGuide(guide);
      setConflictApplyResult(null);
      setConflictPaths((guide.conflict_files || []).join("\n"));
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompact() {
    if (!sessionId || !token) {
      return;
    }
    setLoading(true);
    try {
      const result = await compactWorkflow(sessionId, token);
      setWorkflowOutput(result.summary);
      setPrompt(result.summary);
      pushAgentEvents(["workflow: compact summary ready"]);
      toast.push("Compact summary generated", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUltrareview() {
    if (!sessionId || !token) {
      return;
    }
    setLoading(true);
    try {
      const result = await ultrareviewWorkflow(sessionId, token, {});
      setWorkflowOutput(result.report);
      pushAgentEvents([`workflow: ultrareview risk=${result.risk_level}`]);
      toast.push(`Ultrareview complete (${result.risk_level} risk)`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan() {
    if (!sessionId || !token) {
      return;
    }
    const targets = planTargets
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (targets.length === 0) {
      toast.push("Enter one or more file paths for the plan");
      return;
    }
    setLoading(true);
    try {
      const plan = await createWorkflowPlan(sessionId, token, targets);
      setActivePlanId(plan.plan_id);
      setWorkflowOutput(`Plan ${plan.plan_id} ready for ${plan.targets.join(", ")}`);
      pushAgentEvents([`workflow: plan ${plan.plan_id}`]);
      toast.push(`Plan ${plan.plan_id} created`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecutePlan() {
    if (!sessionId || !token || !activePlanId) {
      toast.push("Create a plan first");
      return;
    }
    setLoading(true);
    try {
      const result = await executeWorkflowPlan(sessionId, token, activePlanId, {
        prompt: prompt.trim() || "Apply grouped updates safely.",
        auto_mode: autoMode,
      });
      setWorkflowOutput(result.message);
      pushAgentEvents([`workflow: plan ${result.status}`]);
      toast.push(result.message, result.status === "applied" ? "success" : undefined);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRollbackPlan() {
    if (!sessionId || !token || !activePlanId) {
      toast.push("No active plan to rollback");
      return;
    }
    setLoading(true);
    try {
      const result = await rollbackWorkflowPlan(sessionId, token, activePlanId);
      setWorkflowOutput(result.message);
      pushAgentEvents([`workflow: rollback ${result.restored_paths.length} file(s)`]);
      toast.push(result.message, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunLoop() {
    if (!sessionId || !token) {
      toast.push("Create or select a session first");
      return;
    }
    if (!loopVerify.trim()) {
      toast.push("Enter a verify command (e.g. pytest -q)");
      return;
    }

    setLoopRunning(true);
    setLoading(true);
    try {
      const result = await runAgentLoop(sessionId, token, {
        verify_command: loopVerify.trim(),
        prompt: loopPrompt.trim() || "Fix verification failures with minimal safe edits.",
        max_attempts: Number(loopMaxAttempts) || 3,
        auto_apply: true,
        auto_mode: autoMode,
      });

      const attemptLines = result.attempts.map((item) => {
        const applied = item.applied ? " · applied" : "";
        const patch = item.patch_source ? ` · patch: ${item.patch_source}` : "";
        return `attempt ${item.attempt}: exit ${item.verify_exit_code}${applied}${patch}`;
      });
      setWorkflowOutput([result.message, ...attemptLines].join("\n"));
      pushAgentEvents([
        result.passed ? `loop: passed — ${result.message}` : `loop: failed — ${result.message}`,
        ...attemptLines,
      ]);

      const lastWithProposal = [...result.attempts].reverse().find((item) => item.proposal_id);
      if (lastWithProposal?.proposal_id) {
        const proposal = await getProposal(sessionId, lastWithProposal.proposal_id, token);
        setPendingProposal(proposal);
      }

      const stored = await listMessages(sessionId, token);
      setMessages(
        stored.map((msg) => ({ id: msg.message_id, role: msg.role, content: msg.content })),
      );
      await getUsageSummary(token).then(setUsage).catch(() => undefined);
      toast.push(result.message, result.passed ? "success" : undefined);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoopRunning(false);
      setLoading(false);
    }
  }

  async function handlePreviewArtifact(artifactId) {
    if (!sessionId || !token || !artifactId) {
      return;
    }
    setLoading(true);
    try {
      const html = await fetchSessionArtifactPreviewHtml(sessionId, artifactId, token);
      setSelectedArtifactId(artifactId);
      setArtifactPreviewHtml(html);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTemplate() {
    if (!templateName.trim() || !templatePrefix.trim()) {
      toast.push("Template name and prompt prefix are required");
      return;
    }
    setLoading(true);
    try {
      await createAgentTemplate(token, {
        name: templateName.trim(),
        description: "Custom reusable agent template",
        prompt_prefix: templatePrefix.trim(),
        verify_command: loopVerify.trim() || null,
      });
      const result = await listAgentTemplates(token);
      setTemplates(result.templates || []);
      toast.push("Template saved", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForkSession() {
    if (!sessionId || !token) {
      return;
    }
    setLoading(true);
    try {
      const forked = await forkSession(sessionId, token);
      setSessionId(forked.session_id);
      setMessages([]);
      setPendingProposal(null);
      await refreshSessions();
      toast.push(`Forked parallel session ${forked.session_id}`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyConflictAssist() {
    setLoading(true);
    try {
      const paths = conflictPaths
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      const result = await applyGitConflictAssist(token, sessionId, {
        target_branch: conflictTargetBranch.trim(),
        strategy: conflictStrategy,
        paths,
      });
      setConflictApplyResult(result);
      setConflictGuide((prev) =>
        prev
          ? {
              ...prev,
              conflict_files: result.remaining_conflicts || [],
              has_conflicts: (result.remaining_conflicts || []).length > 0,
            }
          : prev
      );
      setConflictPaths((result.remaining_conflicts || []).join("\n"));
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (ready && !token) {
    return (
      <section className="panel empty-state">
        <h2>Welcome to CodeForge</h2>
        <p className="small">Login from the top bar to start a coding session.</p>
      </section>
    );
  }

  return (
    <div className="chat-layout">
      <section className="panel">
        <h2>Session</h2>
        <label className="small" htmlFor="projectPath">
          Project Path
        </label>
        <input
          id="projectPath"
          value={projectPath}
          placeholder="c:/path/to/your/project"
          onChange={(event) => setProjectPath(event.target.value)}
          disabled={loading}
        />
        <div className="mt-8">
          <button onClick={handleCreateSession} disabled={loading || !projectPath.trim()}>
            {sessionId ? "New Session" : "Create Session"}
          </button>
        </div>
        <p className="small mt-8">Active: {sessionId ?? "none"}</p>
        <p className="small">Last model: {lastModel}</p>
        {usage ? (
          <p className="small">
            {usage.requests_used_in_period ?? usage.total_requests} requests this month ({usage.requests_remaining} left)
            {" | "}${usage.total_cost_usd.toFixed(4)} | {Math.round(usage.avg_latency_ms)} ms avg
          </p>
        ) : null}

        <h3>Recent Sessions</h3>
        <div className="session-list">
          {sessionHistory.length === 0 ? <p className="small">No saved sessions.</p> : null}
          {sessionHistory.map((entry) => (
            <button
              key={entry.session_id}
              className={`ghost-btn ${entry.session_id === sessionId ? "ghost-btn-active" : ""}`}
              type="button"
              onClick={() => handleSelectSession(entry.session_id)}
              disabled={loading}
            >
              <span>{formatSessionListLabel(entry)}</span>
              <span className="small"> {new Date(entry.created_at).toLocaleString()}</span>
            </button>
          ))}
        </div>

        <hr className="divider" />
        <button type="button" className="ghost-btn" onClick={() => setShowWorkflows((prev) => !prev)}>
          {showWorkflows ? "Hide" : "Show"} Advanced Workflows
        </button>
        {showWorkflows ? (
          <div className="mt-8">
            <div className="replay-toolbar">
              <button type="button" onClick={handleCompact} disabled={!sessionId || loading}>
                Compact
              </button>
              <button type="button" onClick={handleUltrareview} disabled={!sessionId || loading}>
                Ultrareview
              </button>
              <button type="button" onClick={handleForkSession} disabled={!sessionId || loading}>
                Fork Session
              </button>
            </div>

            <h4 className="small mt-8">Verify / fix loop</h4>
            <label className="small" htmlFor="loop-verify">
              Verify command
            </label>
            <input
              id="loop-verify"
              value={loopVerify}
              onChange={(event) => setLoopVerify(event.target.value)}
              disabled={loading || loopRunning}
              placeholder="pytest -q"
            />
            <label className="small" htmlFor="loop-prompt">
              Fix prompt
            </label>
            <textarea
              id="loop-prompt"
              rows={2}
              value={loopPrompt}
              onChange={(event) => setLoopPrompt(event.target.value)}
              disabled={loading || loopRunning}
            />
            <label className="small" htmlFor="loop-max-attempts">
              Max attempts
            </label>
            <input
              id="loop-max-attempts"
              type="number"
              min={1}
              max={10}
              value={loopMaxAttempts}
              onChange={(event) => setLoopMaxAttempts(event.target.value)}
              disabled={loading || loopRunning}
            />
            <div className="replay-toolbar mt-8">
              <button
                type="button"
                onClick={handleRunLoop}
                disabled={!sessionId || loading || loopRunning || !loopVerify.trim()}
              >
                {loopRunning ? "Loop running…" : "Run Loop"}
              </button>
            </div>
            <label className="small" htmlFor="plan-targets">
              Plan targets (space-separated paths)
            </label>
            <input
              id="plan-targets"
              value={planTargets}
              onChange={(event) => setPlanTargets(event.target.value)}
              disabled={loading}
              placeholder="src/main.py tests/test_main.py"
            />
            <label className="small">
              <input
                type="checkbox"
                checked={autoMode}
                onChange={(event) => setAutoMode(event.target.checked)}
                disabled={loading}
              />{" "}
              Auto mode (skip high-risk applies)
            </label>
            <div className="replay-toolbar mt-8">
              <button type="button" onClick={handleCreatePlan} disabled={!sessionId || loading}>
                Create Plan
              </button>
              <button type="button" onClick={handleExecutePlan} disabled={!activePlanId || loading}>
                Run Plan
              </button>
              <button type="button" onClick={handleRollbackPlan} disabled={!activePlanId || loading}>
                Rollback
              </button>
            </div>
            {activePlanId ? <p className="small">Active plan: {activePlanId}</p> : null}
            {workflowOutput ? <pre className="proposal-preview mt-8">{workflowOutput}</pre> : null}

            <h4 className="small mt-8">Agent templates</h4>
            <label className="small" htmlFor="template-select">
              Apply template on send
            </label>
            <select
              id="template-select"
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              disabled={loading}
            >
              <option value="">None</option>
              {templates.map((template) => (
                <option key={template.template_id} value={template.template_id}>
                  {template.name}
                </option>
              ))}
            </select>
            <label className="small" htmlFor="template-name">
              New template name
            </label>
            <input
              id="template-name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              disabled={loading}
            />
            <label className="small" htmlFor="template-prefix">
              Prompt prefix
            </label>
            <textarea
              id="template-prefix"
              rows={3}
              value={templatePrefix}
              onChange={(event) => setTemplatePrefix(event.target.value)}
              disabled={loading}
            />
            <button type="button" onClick={handleCreateTemplate} disabled={loading}>
              Save template
            </button>

            <h4 className="small mt-8">Artifacts preview</h4>
            {artifacts.length === 0 ? (
              <p className="small">No artifacts yet. Assistant responses with fenced html/mermaid blocks are captured automatically.</p>
            ) : (
              <div className="replay-toolbar">
                {artifacts.map((artifact) => (
                  <button
                    key={artifact.artifact_id}
                    type="button"
                    className={`ghost-btn ${selectedArtifactId === artifact.artifact_id ? "ghost-btn-active" : ""}`}
                    onClick={() => handlePreviewArtifact(artifact.artifact_id)}
                    disabled={loading}
                  >
                    {artifact.title}
                  </button>
                ))}
              </div>
            )}
            {artifactPreviewHtml ? (
              <iframe
                title="Artifact preview"
                className="artifact-preview-frame mt-8"
                sandbox="allow-scripts"
                srcDoc={artifactPreviewHtml}
              />
            ) : null}
          </div>
        ) : null}

        <hr className="divider" />
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setShowConflictTool((prev) => !prev)}
        >
          {showConflictTool ? "Hide" : "Show"} Git Conflict Assistant
        </button>
        {showConflictTool ? (
          <div className="mt-8">
            <label className="small" htmlFor="conflict-branch">
              Target Branch
            </label>
            <input
              id="conflict-branch"
              value={conflictTargetBranch}
              onChange={(event) => setConflictTargetBranch(event.target.value)}
              disabled={loading}
            />
            <div className="mt-6">
              <button type="button" onClick={handleLoadConflictGuide} disabled={!sessionId || loading}>
                Load Conflict Guide
              </button>
            </div>
            {conflictGuide ? (
              <>
                <p className="small">Current: {conflictGuide.current_branch}</p>
                <p className="small">Conflicts: {(conflictGuide.conflict_files || []).length}</p>
                <ul>
                  {(conflictGuide.steps || []).map((step) => (
                    <li className="small" key={step}>
                      {step}
                    </li>
                  ))}
                </ul>
                <label className="small" htmlFor="conflict-strategy">
                  Strategy
                </label>
                <select
                  id="conflict-strategy"
                  value={conflictStrategy}
                  onChange={(event) => setConflictStrategy(event.target.value)}
                  disabled={loading}
                >
                  <option value="ours">ours</option>
                  <option value="theirs">theirs</option>
                </select>
                <label className="small" htmlFor="conflict-paths">
                  Paths (one per line, blank = all unresolved)
                </label>
                <textarea
                  id="conflict-paths"
                  rows={4}
                  value={conflictPaths}
                  onChange={(event) => setConflictPaths(event.target.value)}
                  disabled={loading}
                />
                <div className="mt-6">
                  <button type="button" onClick={handleApplyConflictAssist} disabled={loading}>
                    Apply Strategy and Stage
                  </button>
                </div>
              </>
            ) : null}
            {conflictApplyResult ? (
              <p className="small mt-6">
                Applied {(conflictApplyResult.applied_paths || []).length} | Remaining{" "}
                {(conflictApplyResult.remaining_conflicts || []).length}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel chat-panel">
        <h2>Chat</h2>
        <div className="chat-log">
          {messages.length === 0 ? (
            <p className="small">
              {sessionId ? "No messages yet. Ask CodeForge anything." : "Create or select a session to start."}
            </p>
          ) : null}
          {messages.map((msg) => (
            <div className={`msg ${msg.role}`} key={msg.id}>
              <strong>{msg.role === "user" ? "You" : "CodeForge"}</strong>
              <div className="msg-content">{msg.content || "..."}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendPrompt} className="mt-9">
          <textarea
            rows={3}
            placeholder="Ask CodeForge to refactor, explain, or debug..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) {
                  handleSendPrompt(event);
                }
              }
            }}
            disabled={!token || !sessionId || loading}
          />
          <div className="mt-6">
            <button type="submit" disabled={!canSend}>
              {loading ? "Streaming..." : "Send"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Agent Activity</h2>
        {pendingProposal ? (
          <div className="proposal-card">
            <div className="small">Proposal: {pendingProposal.proposal_id}</div>
            <div className="small">File: {pendingProposal.target_file}</div>
            <div className="small">Status: {pendingProposal.status}</div>
            <pre className="proposal-preview">{pendingProposal.patch_preview}</pre>
            {pendingProposal.status === "pending" ? (
              <div className="proposal-actions">
                <button type="button" onClick={() => handleProposalDecision("approve")} disabled={loading}>
                  Approve
                </button>
                <button
                  type="button"
                  className="ghost-btn inline-btn"
                  onClick={() => handleProposalDecision("reject")}
                  disabled={loading}
                >
                  Reject
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="session-list">
          {agentEvents.length === 0 ? <p className="small">No agent events yet.</p> : null}
          {agentEvents.map((entry, index) => (
            <div key={`${index}-${entry}`} className="small">
              {entry}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
