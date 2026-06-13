"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { canWriteSession, isViewOnlySession } from "@codeforge/shared/sessions";

import { useShellBar } from "./shell-context";
import {
  applyGitConflictAssist,
  commitGitChanges,
  compactWorkflow,
  createAgentTemplate,
  createPullRequest,
  createSession,
  createWorkflowPlan,
  decideProposal,
  executeWorkflowPlan,
  fetchSessionArtifactPreviewHtml,
  forkSession,
  getAgentPreferences,
  getGitDiff,
  getGitStatus,
  gitPush,
  listAgentTemplates,
  listCheckpoints,
  listSessionArtifacts,
  getGitConflictGuide,
  getProposal,
  getUsageSummary,
  listMessages,
  listSessions,
  listWorkspaceFiles,
  listAgents,
  rewindCheckpoint,
  rollbackWorkflowPlan,
  runAgentLoop,
  searchSymbols,
  searchWeb,
  sendMessage,
  stageGitFiles,
  uploadSessionAttachments,
  streamShellCommand,
  streamSession,
  ultrareviewWorkflow,
} from "./api";
import { useAuth } from "./auth-context";
import { consumePendingAgentSelection, DEFAULT_AGENT_TYPE } from "./agent-catalog";
import { consumePendingChatGoal } from "./product-features";
import { runSlashCommand } from "./slash-commands";
import { useToast } from "./toast-context";

const DEFAULT_PROJECT_PATH = "/workspaces/demo";

export function useChatPage() {
  const { token, ready } = useAuth();
  const toast = useToast();
  const { setUsage: setShellUsage, setSessionGrant } = useShellBar();

  const [projectPath, setProjectPath] = useState(DEFAULT_PROJECT_PATH);
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
  const [showWorkflows, setShowWorkflows] = useState(true);
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
  const [activeFile, setActiveFile] = useState("");
  const [gitSummary, setGitSummary] = useState("");
  const [shellCommand, setShellCommand] = useState("pytest -q");
  const [shellOutput, setShellOutput] = useState("");
  const [shellRunning, setShellRunning] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolResults, setSymbolResults] = useState([]);
  const [webQuery, setWebQuery] = useState("");
  const [webResults, setWebResults] = useState([]);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [planMode, setPlanMode] = useState(false);
  const [permissionMode, setPermissionMode] = useState("auto_safe");
  const [selectedAgent, setSelectedAgent] = useState(DEFAULT_AGENT_TYPE);
  const [agentCatalog, setAgentCatalog] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [thinkingEvents, setThinkingEvents] = useState([]);
  const [prTitle, setPrTitle] = useState("");
  const [pushBranch, setPushBranch] = useState("");
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

  const mascotState = useMemo(() => {
    if (loading) {
      return "thinking";
    }
    if (pendingProposal?.status === "approved" || pendingProposal?.auto_applied) {
      return "celebrating";
    }
    return "idle";
  }, [loading, pendingProposal]);

  useEffect(() => {
    setProjectPath(localStorage.getItem("codeforge_project_path") || DEFAULT_PROJECT_PATH);
    setSelectedAgent(localStorage.getItem("codeforge_agent_type") || DEFAULT_AGENT_TYPE);
    listAgents()
      .then((data) => setAgentCatalog(data.agents || []))
      .catch(() => setAgentCatalog([]));
  }, []);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    getAgentPreferences(token)
      .then((prefs) => {
        setPlanMode(Boolean(prefs.plan_mode_default));
        setPermissionMode(prefs.permission_mode || "auto_safe");
      })
      .catch(() => undefined);
  }, [ready, token]);

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
    if (!ready || !token || sessionId || loading) {
      return;
    }
    if (sessionHistory.length > 0) {
      handleSelectSession(sessionHistory[0].session_id);
    }
    // Resume the most recent chat once after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, sessionHistory, sessionId, loading]);

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
    if (!token || !sessionId) {
      setWorkspaceFiles([]);
      setGitSummary("");
      return;
    }
    listWorkspaceFiles(token, sessionId)
      .then((result) => setWorkspaceFiles(result.files || []))
      .catch(() => undefined);
    getGitStatus(token, sessionId)
      .then((status) => setGitSummary(`${status.branch} · ${status.summary}`))
      .catch(() => undefined);
  }, [token, sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => streamRef.current?.close(), []);

  useEffect(() => {
    if (!ready || !token || loading) {
      return;
    }
    const pendingAgent = consumePendingAgentSelection();
    if (pendingAgent) {
      setSelectedAgent(pendingAgent);
      localStorage.setItem("codeforge_agent_type", pendingAgent);
    }
    const pending = consumePendingChatGoal();
    if (!pending) {
      return;
    }
    void handleStartWithGoal({
      starterPrompt: pending.prompt,
      planMode: pending.planMode,
      agentType: pendingAgent || selectedAgent,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when auth is ready
  }, [ready, token]);

  function handleAgentChange(nextAgent) {
    setSelectedAgent(nextAgent);
    localStorage.setItem("codeforge_agent_type", nextAgent);
  }

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
      setThinkingEvents([]);
      listCheckpoints(token, nextSessionId)
        .then((result) => setCheckpoints(result.checkpoints || []))
        .catch(() => undefined);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  function pushAgentEvents(entries) {
    setAgentEvents((prev) => [...entries.filter(Boolean), ...prev].slice(0, 12));
  }

  async function dispatchUserMessage(userText, activeSessionId = sessionId, options = {}) {
    if (!token || !activeSessionId || !userText.trim()) {
      return;
    }
    if (!options.skipWritableCheck && !sessionWritable) {
      return;
    }

    const effectivePlanMode = options.planMode ?? planMode;
    const assistantId = `a_${Date.now()}`;
    setStreamingMessageId(assistantId);
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", content: userText },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const messageContext = {
      ...(activeFile.trim() ? { current_file: activeFile.trim() } : {}),
      plan_mode: effectivePlanMode,
      permission_mode: permissionMode,
      agent_type: options.agentType || selectedAgent,
      attached_files: attachedFiles,
    };
    const hasContext = Object.keys(messageContext).length > 0;
    const sent = await sendMessage(
      activeSessionId,
      userText,
      token,
      hasContext ? messageContext : null,
      selectedTemplateId || null,
    );
    setAttachedFiles([]);
    setRoutingSignal({
      intent: sent.intent,
      model_used: sent.model_used,
      confidence_label: sent.confidence_label,
      confidence_score: sent.confidence_score,
      review_required: sent.review_required,
      routing_tier: sent.routing_tier,
      fallback_used: sent.fallback_used,
    });

    const source = streamSession(activeSessionId, token, (evt) => {
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

      if (evt.type === "thinking") {
        const content = evt.payload?.content || "";
        if (content) {
          setThinkingEvents((prev) => [...prev, content]);
          pushAgentEvents([`💭 ${content}`]);
        }
      }

      if (evt.type === "checkpoint_created") {
        const checkpointId = evt.payload?.checkpoint_id;
        if (checkpointId) {
          pushAgentEvents([`Checkpoint ${checkpointId} saved`]);
          listCheckpoints(token, activeSessionId)
            .then((result) => setCheckpoints(result.checkpoints || []))
            .catch(() => undefined);
        }
      }

      if (evt.type === "tool_call") {
        if (evt.payload?.tool === "verify.static" || evt.payload?.tool === "file.patch") {
          pushAgentEvents([`${evt.payload?.tool === "file.patch" ? "Prepared" : "Checking"} ${evt.payload?.target || "change"}…`]);
        }
      }

      if (evt.type === "diff") {
        const applied = evt.payload?.applied || evt.payload?.status === "approved";
        pushAgentEvents([applied ? `✓ Applied ${evt.payload?.file}` : `Updated ${evt.payload?.file}`]);
        if (evt.payload?.proposal_id) {
          setPendingProposal({
            proposal_id: evt.payload.proposal_id,
            target_file: evt.payload.file,
            patch_preview: evt.payload.patch,
            status: applied ? "approved" : evt.payload.status || "pending",
            auto_applied: Boolean(applied),
          });
        }
      }

      if (evt.type === "approval_request") {
        return;
      }

      if (evt.type === "tool_result") {
        if (evt.payload?.message && !String(evt.payload.message).toLowerCase().includes("policy bound")) {
          pushAgentEvents([evt.payload.message]);
        }
      }

      if (evt.type === "error") {
        toast.push(evt.payload?.message || "Agent run failed");
        listMessages(activeSessionId, token)
          .then((stored) => {
            setMessages(
              stored.map((msg) => ({ id: msg.message_id, role: msg.role, content: msg.content })),
            );
          })
          .catch(() => undefined);
        setStreamingMessageId(null);
        setLoading(false);
        source.close();
        return;
      }

      if (evt.type === "complete") {
        listMessages(activeSessionId, token)
          .then((stored) => {
            setMessages(
              stored.map((msg) => ({ id: msg.message_id, role: msg.role, content: msg.content })),
            );
          })
          .catch(() => undefined);
        if (evt.payload?.applied || evt.payload?.auto_applied) {
          pushAgentEvents([`✓ Saved to ${evt.payload?.target_file || "workspace"}`]);
          setPendingProposal((prev) =>
            prev
              ? {
                  ...prev,
                  status: "approved",
                  auto_applied: true,
                  target_file: evt.payload?.target_file || prev.target_file,
                }
              : prev,
          );
        }
        source.close();
        getUsageSummary(token).then(setUsage).catch(() => undefined);
        listSessionArtifacts(activeSessionId, token)
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
  }

  async function handleStartWithGoal({ starterPrompt, planMode: nextPlanMode = false, agentType }) {
    const text = String(starterPrompt || "").trim();
    if (!text || !token) {
      return;
    }
    if (agentType) {
      setSelectedAgent(agentType);
      localStorage.setItem("codeforge_agent_type", agentType);
    }
    if (!projectPath.trim()) {
      toast.push("Pick a project folder first");
      return;
    }
    const usePlanMode = nextPlanMode && !/prd|product requirements|ask me|ask.*questions/i.test(text);
    if (usePlanMode) {
      setPlanMode(true);
    } else if (/prd|product requirements|ask me|ask.*questions/i.test(text)) {
      setPlanMode(false);
    }
    setLoading(true);
    try {
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        localStorage.setItem("codeforge_project_path", projectPath.trim());
        const result = await createSession(projectPath.trim(), token);
        activeSessionId = result.session_id;
        setSessionId(activeSessionId);
        setMessages([]);
        setAgentEvents([]);
        setPendingProposal(null);
        await refreshSessions();
      }
      await dispatchUserMessage(text, activeSessionId, {
        planMode: usePlanMode ? true : planMode,
        agentType: agentType || selectedAgent,
        skipWritableCheck: true,
      });
    } catch (error) {
      toast.push(error.message);
      setLoading(false);
    }
  }

  async function handleSendPrompt(event) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const userText = prompt.trim();
    setPrompt("");
    setLoading(true);

    if (userText.startsWith("/")) {
      try {
        const commandResult = await runSlashCommand({
          text: userText,
          token,
          projectPath: projectPath || null,
          sessionId,
          planMode,
          attachedFiles,
        });
        if (commandResult.handled) {
          if (commandResult.activeFile) {
            setActiveFile(commandResult.activeFile);
          }
          if (commandResult.activePlanId) {
            setActivePlanId(commandResult.activePlanId);
          }
          if (typeof commandResult.planMode === "boolean") {
            setPlanMode(commandResult.planMode);
          }
          if (commandResult.attachedFiles) {
            setAttachedFiles(commandResult.attachedFiles);
          }
          setMessages((prev) => [
            ...prev,
            { id: `u_${Date.now()}`, role: "user", content: userText },
            { id: `a_${Date.now()}`, role: "assistant", content: commandResult.reply || "Done." },
          ]);
          return;
        }
      } catch (error) {
        toast.push(error.message);
        return;
      } finally {
        setLoading(false);
      }
    }

    try {
      await dispatchUserMessage(userText, sessionId);
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

  async function handleRunTemplate(templateId) {
    setSelectedTemplateId(templateId);
    toast.push("Template selected for your next message", "success");
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

  async function handleRefreshGit() {
    if (!sessionId || !token) {
      return;
    }
    try {
      const status = await getGitStatus(token, sessionId);
      setGitSummary(`${status.branch} · ${status.summary}`);
    } catch (error) {
      toast.push(error.message);
    }
  }

  async function handleGitStatus() {
    if (!sessionId || !token) {
      return;
    }
    setLoading(true);
    try {
      const status = await getGitStatus(token, sessionId);
      setGitSummary(`${status.branch} · ${status.summary}`);
      const lines = [`${status.branch} | ${status.summary}`];
      (status.changed_files || []).slice(0, 6).forEach((item) => lines.push(`${item.status} ${item.path}`));
      pushAgentEvents(lines);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGitDiff() {
    if (!sessionId || !token) {
      return;
    }
    setLoading(true);
    try {
      const target = activeFile.trim() || null;
      const diff = await getGitDiff(token, sessionId, target);
      setShellOutput(diff.diff || diff.stat || "No diff.");
      pushAgentEvents([`git diff ${target || "worktree"}`]);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStageAll() {
    if (!sessionId || !token) {
      return;
    }
    setLoading(true);
    try {
      const result = await stageGitFiles(token, sessionId, { all_files: true, paths: [] });
      setGitSummary(`staged ${(result.paths || []).length} path(s)`);
      toast.push("All changes staged", "success");
      await handleRefreshGit();
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGitCommit() {
    if (!sessionId || !token || !commitMessage.trim()) {
      return;
    }
    setLoading(true);
    try {
      const result = await commitGitChanges(token, sessionId, commitMessage.trim());
      setCommitMessage("");
      setGitSummary(`commit: ${result.message}`);
      toast.push("Commit created", "success");
      await handleRefreshGit();
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGitPush() {
    if (!sessionId || !token) {
      return;
    }
    setLoading(true);
    try {
      const result = await gitPush(token, sessionId, {
        remote: "origin",
        branch: pushBranch.trim() || undefined,
      });
      pushAgentEvents([result.output || "Push completed"]);
      toast.push("Branch pushed", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePr() {
    if (!sessionId || !token) {
      return;
    }
    setLoading(true);
    try {
      const result = await createPullRequest(token, sessionId, {
        title: prTitle.trim() || "CodeForge changes",
        body: "Automated pull request from CodeForge workspace.",
        provider: "github",
      });
      pushAgentEvents([result.url || result.message || "PR created"]);
      toast.push("Pull request created", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshCheckpoints() {
    if (!sessionId || !token) {
      return;
    }
    try {
      const result = await listCheckpoints(token, sessionId);
      setCheckpoints(result.checkpoints || []);
    } catch (error) {
      toast.push(error.message);
    }
  }

  async function handleRewindCheckpoint(checkpointId) {
    if (!sessionId || !token || !checkpointId) {
      return;
    }
    setLoading(true);
    try {
      const result = await rewindCheckpoint(token, sessionId, checkpointId);
      pushAgentEvents([`Rewound: ${(result.restored_paths || []).join(", ")}`]);
      toast.push("Checkpoint restored", "success");
      await handleRefreshCheckpoints();
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteAgentPlan() {
    setPlanMode(false);
    const lastUser = [...messages].reverse().find((msg) => msg.role === "user");
    if (lastUser?.content) {
      setPrompt(lastUser.content);
      toast.push("Plan mode off — send the message again to execute", "success");
    } else {
      toast.push("Plan mode disabled — ready to execute writes");
    }
  }

  async function handleRunShell() {
    if (!sessionId || !token || !shellCommand.trim()) {
      return;
    }
    setShellRunning(true);
    setShellOutput("");
    try {
      const chunks = [];
      for await (const evt of streamShellCommand(token, sessionId, { command: shellCommand.trim() })) {
        if (evt.type === "shell_output") {
          chunks.push(evt.payload?.chunk || evt.payload?.output || "");
          setShellOutput(chunks.join(""));
        }
        if (evt.type === "shell_result") {
          chunks.push(`\n[exit ${evt.payload?.exit_code ?? "?"}]`);
          setShellOutput(chunks.join(""));
        }
      }
      pushAgentEvents([`shell: ${shellCommand.trim()}`]);
    } catch (error) {
      toast.push(error.message);
      setShellOutput(error.message);
    } finally {
      setShellRunning(false);
    }
  }

  async function handleSearchSymbols() {
    if (!sessionId || !token || !symbolQuery.trim()) {
      return;
    }
    setLoading(true);
    try {
      const result = await searchSymbols(token, sessionId, symbolQuery.trim());
      setSymbolResults(result.matches || []);
      if (result.matches?.[0]) {
        setActiveFile(result.matches[0].file);
      }
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleWebSearch() {
    if (!sessionId || !token || !webQuery.trim()) {
      return;
    }
    setLoading(true);
    try {
      const result = await searchWeb(token, sessionId, webQuery.trim());
      setWebResults(result.results || []);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshFiles() {
    if (!sessionId || !token) {
      return;
    }
    try {
      const result = await listWorkspaceFiles(token, sessionId);
      setWorkspaceFiles(result.files || []);
      toast.push(`Loaded ${result.files?.length || 0} files`, "success");
    } catch (error) {
      toast.push(error.message);
    }
  }

  async function handleUploadAttachments(fileList) {
    if (!sessionId || !token || !fileList.length) {
      return;
    }
    setLoading(true);
    try {
      const result = await uploadSessionAttachments(token, sessionId, fileList);
      const paths = (result.uploaded || []).map((item) => item.path);
      setAttachedFiles((prev) => [...new Set([...prev, ...paths])]);
      toast.push(`Attached ${paths.length} file(s)`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAttachWorkspaceFile(path) {
    setAttachedFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }

  function handleRemoveAttachment(path) {
    setAttachedFiles((prev) => prev.filter((item) => item !== path));
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
    activeFile,
    setActiveFile,
    gitSummary,
    shellCommand,
    setShellCommand,
    shellOutput,
    shellRunning,
    symbolQuery,
    setSymbolQuery,
    symbolResults,
    webQuery,
    setWebQuery,
    webResults,
    workspaceFiles,
    commitMessage,
    setCommitMessage,
    planMode,
    setPlanMode,
    permissionMode,
    setPermissionMode,
    selectedAgent,
    setSelectedAgent,
    agentCatalog,
    handleAgentChange,
    attachedFiles,
    setAttachedFiles,
    handleUploadAttachments,
    handleAttachWorkspaceFile,
    handleRemoveAttachment,
    checkpoints,
    thinkingEvents,
    prTitle,
    setPrTitle,
    pushBranch,
    setPushBranch,
    routingSignal,
    streamingMessageId,
    chatEndRef,
    currentSession,
    sessionWritable,
    canSend,
    mascotState,
    handleCreateSession,
    handleStartWithGoal,
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
    handleRunTemplate,
    handleCreateTemplate,
    handleForkSession,
    handleApplyConflictAssist,
    handleRefreshGit,
    handleGitStatus,
    handleGitDiff,
    handleStageAll,
    handleGitCommit,
    handleGitPush,
    handleCreatePr,
    handleRefreshCheckpoints,
    handleRewindCheckpoint,
    handleExecuteAgentPlan,
    handleRunShell,
    handleSearchSymbols,
    handleWebSearch,
    handleRefreshFiles,
  };
}
