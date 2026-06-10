"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { canWriteSession, isViewOnlySession } from "@codeforge/shared/sessions";

import { useShellBar } from "./shell-context";
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
} from "./api";
import { useAuth } from "./auth-context";
import { useToast } from "./toast-context";

export function useChatPage() {
  const { token, ready } = useAuth();
  const toast = useToast();
  const { setUsage: setShellUsage, setSessionGrant } = useShellBar();

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
  const [sessionFilter, setSessionFilter] = useState("");
  const [routingSignal, setRoutingSignal] = useState(null);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const chatEndRef = useRef(null);
  const streamRef = useRef(null);

  const currentSession = useMemo(
    () => sessionHistory.find((entry) => entry.session_id === sessionId) || null,
    [sessionHistory, sessionId],
  );

  const sessionWritable = useMemo(() => canWriteSession(currentSession), [currentSession]);

  const canSend = useMemo(
    () => Boolean(token && sessionId && prompt.trim() && !loading && sessionWritable),
    [token, sessionId, prompt, loading, sessionWritable],
  );

  useEffect(() => {
    setProjectPath(localStorage.getItem("codeforge_project_path") || "");
  }, []);

  useEffect(() => {
    setShellUsage(usage);
  }, [usage, setShellUsage]);

  useEffect(() => {
    if (!currentSession) {
      setSessionGrant(null);
      return;
    }
    setSessionGrant({
      viewOnly: isViewOnlySession(currentSession),
      sessionId: currentSession.session_id,
    });
  }, [currentSession, setSessionGrant]);

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
    setStreamingMessageId(assistantId);
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", content: userText },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const sent = await sendMessage(sessionId, userText, token, null, selectedTemplateId || null);
      setLastModel(sent.model_used ?? "-");
      setRoutingSignal({
        intent: sent.intent,
        model_used: sent.model_used,
        confidence_label: sent.confidence_label,
        confidence_score: sent.confidence_score,
        review_required: sent.review_required,
        routing_tier: sent.routing_tier,
        fallback_used: sent.fallback_used,
      });
      pushAgentEvents([
        `route: ${sent.intent ?? "unknown"} via ${sent.model_used ?? "unknown"}`,
        sent.routing_reason ? `why: ${sent.routing_reason}` : null,
        `confidence: ${sent.confidence_label ?? "unknown"} (${Math.round((sent.confidence_score ?? 0) * 100)}%)`,
        sent.review_required ? "review: human review recommended" : null,
      ]);

      const source = streamSession(sessionId, token, (evt) => {
        if (evt.type === "run_started") {
          setRoutingSignal({
            intent: evt.payload?.intent,
            model_used: evt.payload?.model,
            confidence_label: evt.payload?.confidence_label,
            confidence_score: evt.payload?.confidence_score,
            review_required: evt.payload?.review_required,
            routing_tier: evt.payload?.routing_tier,
            fallback_used: evt.payload?.fallback_used,
          });
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
          setStreamingMessageId(null);
          setLoading(false);
        }
      });
      streamRef.current = source;

      source.onerror = () => {
        source.close();
        toast.push("Streaming connection lost");
        setStreamingMessageId(null);
        setLoading(false);
      };
    } catch (error) {
      toast.push(error.message);
      setStreamingMessageId(null);
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

  return {
    ready,
    token,
    projectPath,
    setProjectPath,
    sessionId,
    sessionHistory,
    prompt,
    setPrompt,
    messages,
    loading,
    lastModel,
    usage,
    agentEvents,
    pendingProposal,
    showConflictTool,
    setShowConflictTool,
    conflictTargetBranch,
    setConflictTargetBranch,
    conflictGuide,
    conflictStrategy,
    setConflictStrategy,
    conflictPaths,
    setConflictPaths,
    showWorkflows,
    setShowWorkflows,
    planTargets,
    setPlanTargets,
    activePlanId,
    workflowOutput,
    autoMode,
    setAutoMode,
    loopVerify,
    setLoopVerify,
    loopPrompt,
    setLoopPrompt,
    loopMaxAttempts,
    setLoopMaxAttempts,
    loopRunning,
    artifacts,
    selectedArtifactId,
    artifactPreviewHtml,
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    templateName,
    setTemplateName,
    templatePrefix,
    setTemplatePrefix,
    sessionFilter,
    setSessionFilter,
    routingSignal,
    streamingMessageId,
    chatEndRef,
    currentSession,
    sessionWritable,
    canSend,
    handleCreateSession,
    handleSelectSession,
    handleSendPrompt,
    handleProposalDecision,
    handleLoadConflictGuide,
    handleCompact,
    handleUltrareview,
    handleCreatePlan,
    handleExecutePlan,
    handleRollbackPlan,
    handleRunLoop,
    handlePreviewArtifact,
    handleCreateTemplate,
    handleForkSession,
    handleApplyConflictAssist,
  };
}
