import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  formatEvent,
  formatRoutingSignal,
  routingSignalFromMessageResponse,
  routingSignalFromPayload,
} from "@codeforge/shared/sse";
import { canWriteSession } from "@codeforge/shared/sessions";
import { useDesktopAuth } from "./DesktopAuthContext";
import { loadWorkspaceState, saveWorkspaceState } from "./desktop-auth";
import { useDesktopNotify } from "./useDesktopNotify";
import { runSlashCommand } from "./slash-commands";
import {
  createSession,
  decideProposal,
  getFilePreview,
  getGitDiff,
  getGitStatus,
  getProposal,
  getUsageSummary,
  listMessages,
  listSessions,
  compactWorkflow,
  createWorkflowPlan,
  executeWorkflowPlan,
  createAgentTemplate,
  fetchSessionArtifactPreviewHtml,
  forkSession,
  listAgentTemplates,
  listSessionArtifacts,
  rollbackWorkflowPlan,
  runAgentLoop,
  sendMessage,
  streamSessionEvents,
  streamShellCommand,
  ultrareviewWorkflow,
} from "./api";

export function useCodeWorkspace() {
  const { token } = useDesktopAuth();
  const { statusMessage, errorMessage, reportError, reportSuccess } = useDesktopNotify();
  const stored = useMemo(() => loadWorkspaceState(), []);

  const [projectPath, setProjectPath] = useState(import.meta.env.VITE_CODEFORGE_PROJECT_PATH || stored.projectPath || "");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(stored.sessionId || "");
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastModel, setLastModel] = useState("-");
  const [routingSignal, setRoutingSignal] = useState(null);
  const [usage, setUsage] = useState(null);
  const [activity, setActivity] = useState([]);
  const [pendingProposal, setPendingProposal] = useState(null);
  const [gitStatus, setGitStatus] = useState(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [filePreview, setFilePreview] = useState("");
  const [gitDiff, setGitDiff] = useState("");
  const [shellCommand, setShellCommand] = useState("Get-ChildItem");
  const [shellOutput, setShellOutput] = useState("");
  const [loopVerify, setLoopVerify] = useState("pytest -q");
  const [loopRunning, setLoopRunning] = useState(false);
  const [planTargets, setPlanTargets] = useState("");
  const [activePlanId, setActivePlanId] = useState("");
  const [workflowOutput, setWorkflowOutput] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [artifactPreviewHtml, setArtifactPreviewHtml] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("Code reviewer");
  const [templatePrefix, setTemplatePrefix] = useState(
    "You are a senior reviewer. Focus on correctness, security, and test coverage.",
  );
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const chatEndRef = useRef(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === sessionId) || null,
    [sessionId, sessions],
  );

  const sessionWritable = canWriteSession(currentSession);
  const canSend = Boolean(token && sessionId && prompt.trim() && !loading && sessionWritable);

  const pushActivity = (entries) => {
    setActivity((previous) => [...entries.filter(Boolean), ...previous].slice(0, 16));
  };

  async function refreshUsage(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const summary = await getUsageSummary(activeToken);
    setUsage(summary);
  }

  async function refreshGit(activeToken = token, activeSessionId = sessionId) {
    if (!activeToken || !activeSessionId) {
      return;
    }
    const status = await getGitStatus(activeToken, activeSessionId);
    setGitStatus(status);
  }

  async function refreshSessions(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const list = await listSessions(activeToken);
    setSessions(list);
    if (!sessionId && list.length > 0) {
      setSessionId(list[0].session_id);
      saveWorkspaceState({ sessionId: list[0].session_id });
    }
  }

  async function handlePickPath() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setProjectPath(selected);
        saveWorkspaceState({ projectPath: selected });
      }
    } catch {
      // Plain Vite dev outside Tauri.
    }
  }

  async function handleCreateSession() {
    if (!token || !projectPath.trim()) {
      reportError("Login and set a project path first");
      return;
    }
    setLoading(true);
    reportError("");
    try {
      const created = await createSession(token, projectPath.trim());
      saveWorkspaceState({ projectPath: projectPath.trim(), sessionId: created.session_id });
      setSessionId(created.session_id);
      setMessages([]);
      setPendingProposal(null);
      setActivity([]);
      await refreshSessions(token);
      await refreshGit(token, created.session_id);
      reportSuccess(`Session ${created.session_id} created`);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSession(nextSessionId) {
    if (!token) {
      return;
    }
    setLoading(true);
    reportError("");
    try {
      const storedMessages = await listMessages(token, nextSessionId);
      setSessionId(nextSessionId);
      saveWorkspaceState({ sessionId: nextSessionId });
      setMessages(
        storedMessages.map((message) => ({
          id: message.message_id,
          role: message.role,
          content: message.content,
        })),
      );
      setPendingProposal(null);
      setActivity([]);
      await refreshGit(token, nextSessionId);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewFile(path) {
    if (!token || !sessionId || !path) {
      return;
    }
    setSelectedFile(path);
    setLoading(true);
    reportError("");
    try {
      const [preview, diff] = await Promise.all([
        getFilePreview(token, sessionId, path),
        getGitDiff(token, sessionId, path).catch(() => null),
      ]);
      setFilePreview(preview.excerpt || preview.content || "(empty file)");
      setGitDiff(diff?.diff || "");
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const userText = prompt.trim();
    setPrompt("");
    setLoading(true);
    reportError("");

    if (userText.startsWith("/")) {
      try {
        const commandResult = await runSlashCommand({
          text: userText,
          token,
          projectPath: projectPath || null,
          sessionId,
        });
        if (commandResult.handled) {
          setMessages((previous) => [
            ...previous,
            { id: `user_${Date.now()}`, role: "user", content: userText },
            { id: `assistant_${Date.now()}`, role: "assistant", content: commandResult.reply || "Done." },
          ]);
          return;
        }
      } catch (error) {
        reportError(error.message);
        return;
      } finally {
        setLoading(false);
      }
    }

    const assistantId = `assistant_${Date.now()}`;
    setStreamingMessageId(assistantId);
    setMessages((previous) => [
      ...previous,
      { id: `user_${Date.now()}`, role: "user", content: userText },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const sent = await sendMessage(
        token,
        sessionId,
        userText,
        projectPath,
        selectedFile || null,
        selectedTemplateId || null,
      );
      setLastModel(sent.model_used ?? "-");
      const nextRoutingSignal = routingSignalFromMessageResponse(sent);
      setRoutingSignal(nextRoutingSignal);
      pushActivity([
        formatRoutingSignal(nextRoutingSignal),
        sent.routing_reason ? `why: ${sent.routing_reason}` : null,
      ]);

      for await (const event of streamSessionEvents(token, sessionId)) {
        if (event.type === "token") {
          const chunk = event.payload?.content ?? event.content ?? "";
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId ? { ...message, content: message.content + chunk } : message,
            ),
          );
        }

        if (event.type === "run_started") {
          setRoutingSignal(routingSignalFromPayload(event.payload));
          pushActivity([formatEvent(event)]);
        }

        if (event.type === "tool_call") {
          pushActivity([formatEvent(event)]);
        }

        if (event.type === "diff" || event.type === "approval_request") {
          pushActivity([formatEvent(event)]);
          const proposalId = event.payload?.proposal_id;
          if (proposalId) {
            const proposal = await getProposal(token, sessionId, proposalId).catch(() => null);
            if (proposal) {
              setPendingProposal(proposal);
            } else if (event.type === "diff") {
              setPendingProposal({
                proposal_id: proposalId,
                target_file: event.payload?.file,
                patch_preview: event.payload?.patch,
                status: "pending",
              });
            }
          }
        }

        if (event.type === "complete") {
          setRoutingSignal((previous) => ({
            ...(previous || {}),
            ...routingSignalFromPayload(event.payload),
          }));
          pushActivity([
            formatEvent(event),
            event.payload?.artifact_ids?.length ? `artifacts: ${event.payload.artifact_ids.join(", ")}` : null,
          ]);
          listSessionArtifacts(token, sessionId)
            .then((result) => setArtifacts(result.artifacts || []))
            .catch(() => undefined);
          break;
        }
      }

      await refreshUsage();
      await refreshGit();
    } catch (error) {
      reportError(error.message);
    } finally {
      setStreamingMessageId(null);
      setLoading(false);
    }
  }

  async function handleProposalDecision(action) {
    if (!pendingProposal?.proposal_id || !token || !sessionId) {
      return;
    }
    setLoading(true);
    reportError("");
    try {
      const result = await decideProposal(token, sessionId, pendingProposal.proposal_id, action);
      setPendingProposal((previous) => (previous ? { ...previous, status: result.status } : previous));
      pushActivity([`proposal ${result.status}: ${result.target_file}`]);
      if (action === "approve") {
        const storedMessages = await listMessages(token, sessionId);
        setMessages(
          storedMessages.map((message) => ({
            id: message.message_id,
            role: message.role,
            content: message.content,
          })),
        );
        await refreshGit();
      }
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunShell() {
    if (!token || !sessionId || !shellCommand.trim()) {
      return;
    }
    setLoading(true);
    setShellOutput("");
    reportError("");
    try {
      for await (const event of streamShellCommand(token, sessionId, {
        command: shellCommand.trim(),
        timeout_seconds: 60,
      })) {
        pushActivity([formatEvent(event)]);
        if (event.type === "shell_output") {
          setShellOutput((previous) => `${previous}${event.payload?.content || ""}`);
        }
        if (event.type === "shell_result") {
          setShellOutput(
            (previous) =>
              `${previous}\n[exit ${event.payload?.exit_code ?? "?"} | ${event.payload?.output_lines ?? 0} lines]`,
          );
        }
      }
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompact() {
    if (!token || !sessionId) {
      return;
    }
    setLoading(true);
    try {
      const result = await compactWorkflow(token, sessionId);
      setWorkflowOutput(result.summary);
      setPrompt(result.summary);
      pushActivity(["workflow: compact"]);
      reportSuccess("Compact summary ready");
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUltrareview() {
    if (!token || !sessionId) {
      return;
    }
    setLoading(true);
    try {
      const result = await ultrareviewWorkflow(token, sessionId, {});
      setWorkflowOutput(result.report);
      pushActivity([`workflow: ultrareview ${result.risk_level}`]);
      reportSuccess(`Ultrareview complete (${result.risk_level})`);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewArtifact(artifactId) {
    if (!token || !sessionId || !artifactId) {
      return;
    }
    setLoading(true);
    reportError("");
    try {
      const html = await fetchSessionArtifactPreviewHtml(token, sessionId, artifactId);
      setSelectedArtifactId(artifactId);
      setArtifactPreviewHtml(html);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTemplate() {
    if (!token || !templateName.trim() || !templatePrefix.trim()) {
      reportError("Template name and prompt prefix are required");
      return;
    }
    setLoading(true);
    reportError("");
    try {
      await createAgentTemplate(token, {
        name: templateName.trim(),
        description: "Custom reusable agent template",
        prompt_prefix: templatePrefix.trim(),
        verify_command: loopVerify.trim() || null,
      });
      const result = await listAgentTemplates(token);
      setTemplates(result.templates || []);
      reportSuccess("Template saved");
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForkSession() {
    if (!token || !sessionId) {
      return;
    }
    setLoading(true);
    try {
      const forked = await forkSession(token, sessionId);
      setSessionId(forked.session_id);
      saveWorkspaceState({ sessionId: forked.session_id });
      setMessages([]);
      await refreshSessions(token);
      reportSuccess(`Forked session ${forked.session_id}`);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan() {
    if (!token || !sessionId) {
      return;
    }
    const targets = planTargets
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (targets.length === 0) {
      reportError("Enter plan target file paths");
      return;
    }
    setLoading(true);
    try {
      const plan = await createWorkflowPlan(token, sessionId, targets);
      setActivePlanId(plan.plan_id);
      setWorkflowOutput(`Plan ${plan.plan_id}: ${plan.targets.join(", ")}`);
      pushActivity([`workflow: plan ${plan.plan_id}`]);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecutePlan() {
    if (!token || !sessionId || !activePlanId) {
      reportError("Create a plan first");
      return;
    }
    setLoading(true);
    try {
      const result = await executeWorkflowPlan(token, sessionId, activePlanId, {
        prompt: prompt.trim() || "Apply grouped updates safely.",
        auto_mode: autoMode,
      });
      setWorkflowOutput(result.message);
      pushActivity([`workflow: plan ${result.status}`]);
      await refreshGit();
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRollbackPlan() {
    if (!token || !sessionId || !activePlanId) {
      reportError("No active plan");
      return;
    }
    setLoading(true);
    try {
      const result = await rollbackWorkflowPlan(token, sessionId, activePlanId);
      setWorkflowOutput(result.message);
      pushActivity([`workflow: rollback ${result.restored_paths.length} file(s)`]);
      await refreshGit();
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunLoop() {
    if (!token || !sessionId || !loopVerify.trim()) {
      return;
    }
    setLoopRunning(true);
    reportError("");
    try {
      const result = await runAgentLoop(token, sessionId, {
        verify_command: loopVerify.trim(),
        prompt: "Fix verification failures with minimal safe edits.",
        max_attempts: 5,
        auto_apply: true,
        auto_mode: autoMode,
        current_file: selectedFile || null,
      });
      pushActivity([
        result.passed ? `loop passed: ${result.message}` : `loop failed: ${result.message}`,
        ...result.attempts.map(
          (item) => `attempt ${item.attempt}: exit ${item.verify_exit_code}${item.applied ? " applied" : ""}`,
        ),
      ]);
      if (result.attempts.length > 0) {
        const lastProposal = [...result.attempts].reverse().find((item) => item.proposal_id);
        if (lastProposal?.proposal_id) {
          const proposal = await getProposal(token, sessionId, lastProposal.proposal_id).catch(() => null);
          if (proposal) {
            setPendingProposal(proposal);
          }
        }
      }
      await refreshGit();
      await refreshUsage();
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoopRunning(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setSessions([]);
      setMessages([]);
      setUsage(null);
      return;
    }
    refreshSessions(token).catch(() => undefined);
    refreshUsage(token).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!token) {
      return;
    }
    refreshSessions(token).catch(() => null);
    refreshUsage(token).catch(() => null);
    listAgentTemplates(token)
      .then((result) => setTemplates(result.templates || []))
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!token || !sessionId) {
      setArtifacts([]);
      setSelectedArtifactId("");
      setArtifactPreviewHtml("");
      return;
    }
    refreshGit(token, sessionId).catch(() => null);
    listSessionArtifacts(token, sessionId)
      .then((result) => setArtifacts(result.artifacts || []))
      .catch(() => undefined);
  }, [token, sessionId]);

  useEffect(() => {
    saveWorkspaceState({ projectPath, sessionId });
  }, [projectPath, sessionId]);

  const changedFiles = [
    ...(gitStatus?.changed_files || []).map((item) => item.path),
    ...(gitStatus?.untracked_files || []),
  ];

  return {
    token,
    statusMessage,
    errorMessage,
    projectPath,
    setProjectPath,
    sessions,
    sessionId,
    messages,
    prompt,
    setPrompt,
    loading,
    lastModel,
    routingSignal,
    usage,
    activity,
    pendingProposal,
    gitStatus,
    selectedFile,
    setSelectedFile,
    filePreview,
    gitDiff,
    shellCommand,
    setShellCommand,
    shellOutput,
    loopVerify,
    setLoopVerify,
    loopRunning,
    planTargets,
    setPlanTargets,
    activePlanId,
    workflowOutput,
    autoMode,
    setAutoMode,
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
    streamingMessageId,
    chatEndRef,
    currentSession,
    sessionWritable,
    canSend,
    changedFiles,
    handlePickPath,
    handleCreateSession,
    handleSelectSession,
    handlePreviewFile,
    handleSend,
    handleProposalDecision,
    handleRunShell,
    handleCompact,
    handleUltrareview,
    handlePreviewArtifact,
    handleCreateTemplate,
    handleForkSession,
    handleCreatePlan,
    handleExecutePlan,
    handleRollbackPlan,
    handleRunLoop,
  };
}
