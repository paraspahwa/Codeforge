import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  formatEvent,
  formatRoutingSignal,
  routingSignalFromMessageResponse,
  routingSignalFromPayload,
} from "@codeforge/shared/sse";
import { formatSessionListLabel } from "@codeforge/shared/sessions";
import { useDesktopAuth } from "./DesktopAuthContext";
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

const STORAGE_KEY = "codeforge.desktop.code";

function loadStoredState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStoredState(patch) {
  const current = loadStoredState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export default function CodeWorkspace() {
  const { token } = useDesktopAuth();
  const stored = useMemo(() => loadStoredState(), []);

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
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const chatEndRef = useRef(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === sessionId) || null,
    [sessionId, sessions],
  );

  const canSend = Boolean(token && sessionId && prompt.trim() && !loading);

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

  const pushActivity = (entries) => {
    setActivity((previous) => [...entries.filter(Boolean), ...previous].slice(0, 16));
  };

  async function handlePickPath() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setProjectPath(selected);
        saveStoredState({ projectPath: selected });
      }
    } catch {
      // Plain Vite dev outside Tauri.
    }
  }

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
      saveStoredState({ sessionId: list[0].session_id });
    }
  }

  async function handleCreateSession() {
    if (!token || !projectPath.trim()) {
      setErrorMessage("Login and set a project path first");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const created = await createSession(token, projectPath.trim());
      saveStoredState({ projectPath: projectPath.trim(), sessionId: created.session_id });
      setSessionId(created.session_id);
      setMessages([]);
      setPendingProposal(null);
      setActivity([]);
      await refreshSessions(token);
      await refreshGit(token, created.session_id);
      setStatusMessage(`Session ${created.session_id} created`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSession(nextSessionId) {
    if (!token) {
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const storedMessages = await listMessages(token, nextSessionId);
      setSessionId(nextSessionId);
      saveStoredState({ sessionId: nextSessionId });
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
      setErrorMessage(error.message);
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
    setErrorMessage("");
    try {
      const [preview, diff] = await Promise.all([
        getFilePreview(token, sessionId, path),
        getGitDiff(token, sessionId, path).catch(() => null),
      ]);
      setFilePreview(preview.excerpt || preview.content || "(empty file)");
      setGitDiff(diff?.diff || "");
    } catch (error) {
      setErrorMessage(error.message);
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
    setErrorMessage("");

    const assistantId = `assistant_${Date.now()}`;
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
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProposalDecision(action) {
    if (!pendingProposal?.proposal_id || !token || !sessionId) {
      return;
    }
    setLoading(true);
    setErrorMessage("");
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
      setErrorMessage(error.message);
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
    setErrorMessage("");
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
      setErrorMessage(error.message);
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
      setStatusMessage("Compact summary ready");
    } catch (error) {
      setErrorMessage(error.message);
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
      setStatusMessage(`Ultrareview complete (${result.risk_level})`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewArtifact(artifactId) {
    if (!token || !sessionId || !artifactId) {
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const html = await fetchSessionArtifactPreviewHtml(token, sessionId, artifactId);
      setSelectedArtifactId(artifactId);
      setArtifactPreviewHtml(html);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTemplate() {
    if (!token || !templateName.trim() || !templatePrefix.trim()) {
      setErrorMessage("Template name and prompt prefix are required");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      await createAgentTemplate(token, {
        name: templateName.trim(),
        description: "Custom reusable agent template",
        prompt_prefix: templatePrefix.trim(),
        verify_command: loopVerify.trim() || null,
      });
      const result = await listAgentTemplates(token);
      setTemplates(result.templates || []);
      setStatusMessage("Template saved");
    } catch (error) {
      setErrorMessage(error.message);
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
      saveStoredState({ sessionId: forked.session_id });
      setMessages([]);
      await refreshSessions(token);
      setStatusMessage(`Forked session ${forked.session_id}`);
    } catch (error) {
      setErrorMessage(error.message);
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
      setErrorMessage("Enter plan target file paths");
      return;
    }
    setLoading(true);
    try {
      const plan = await createWorkflowPlan(token, sessionId, targets);
      setActivePlanId(plan.plan_id);
      setWorkflowOutput(`Plan ${plan.plan_id}: ${plan.targets.join(", ")}`);
      pushActivity([`workflow: plan ${plan.plan_id}`]);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecutePlan() {
    if (!token || !sessionId || !activePlanId) {
      setErrorMessage("Create a plan first");
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
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRollbackPlan() {
    if (!token || !sessionId || !activePlanId) {
      setErrorMessage("No active plan");
      return;
    }
    setLoading(true);
    try {
      const result = await rollbackWorkflowPlan(token, sessionId, activePlanId);
      setWorkflowOutput(result.message);
      pushActivity([`workflow: rollback ${result.restored_paths.length} file(s)`]);
      await refreshGit();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunLoop() {
    if (!token || !sessionId || !loopVerify.trim()) {
      return;
    }
    setLoopRunning(true);
    setErrorMessage("");
    try {
      const result = await runAgentLoop(token, sessionId, {
        verify_command: loopVerify.trim(),
        prompt: "Fix verification failures with minimal safe edits.",
        max_attempts: 3,
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
      setErrorMessage(error.message);
    } finally {
      setLoopRunning(false);
    }
  }

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
    saveStoredState({ projectPath, sessionId });
  }, [projectPath, sessionId]);

  const changedFiles = [
    ...(gitStatus?.changed_files || []).map((item) => item.path),
    ...(gitStatus?.untracked_files || []),
  ];

  return (
    <div className="code-workspace">
      <header className="workspace-header">
        <div>
          <h1>Code Mode</h1>
          <p className="muted">Chat, diff review, git, shell, and verify/fix loops on the shared backend.</p>
        </div>
        <div className="header-meta">
          {usage ? (
            <span className="usage-pill">
              {usage.requests_used_in_period ?? usage.total_requests}/{usage.request_limit} this month
              {" · "}
              {usage.requests_remaining} left
            </span>
          ) : null}
          <span className="muted">model: {lastModel}</span>
        </div>
      </header>

      {routingSignal ? (
        <div className={`routing-signal ${routingSignal.review_required ? "routing-signal-review" : ""}`}>
          <span>{formatRoutingSignal(routingSignal)}</span>
          {routingSignal.review_required ? (
            <strong>Human review recommended before applying changes.</strong>
          ) : null}
        </div>
      ) : null}

      {statusMessage ? <div className="status success">{statusMessage}</div> : null}
      {errorMessage ? <div className="status error">{errorMessage}</div> : null}

      <section className="workspace-toolbar card">
        <div className="toolbar-group toolbar-grow">
          <label htmlFor="code-path">Project</label>
          <input
            id="code-path"
            value={projectPath}
            onChange={(event) => setProjectPath(event.target.value)}
            disabled={loading}
            placeholder="c:/path/to/project"
          />
          <button type="button" onClick={handlePickPath} disabled={loading}>
            Pick Folder
          </button>
          <button type="button" onClick={handleCreateSession} disabled={!token || !projectPath.trim() || loading}>
            New Session
          </button>
        </div>
      </section>

      <div className="workspace-grid">
        <aside className="workspace-sidebar card">
          <h2>Sessions</h2>
          <select
            value={sessionId}
            onChange={(event) => handleSelectSession(event.target.value)}
            disabled={loading || sessions.length === 0}
          >
            <option value="">Select session</option>
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {formatSessionListLabel(session)}
              </option>
            ))}
          </select>
          {currentSession ? <p className="muted small">{currentSession.project_path}</p> : null}

          <h3>Git</h3>
          {gitStatus ? (
            <>
              <p className="small">
                <strong>{gitStatus.branch}</strong> · {gitStatus.clean ? "clean" : "dirty"}
              </p>
              <p className="muted small">{gitStatus.summary}</p>
              <div className="file-list">
                {changedFiles.length === 0 ? <p className="muted small">No changed files.</p> : null}
                {changedFiles.map((path) => (
                  <button
                    key={path}
                    type="button"
                    className={`file-btn ${selectedFile === path ? "file-btn-active" : ""}`}
                    onClick={() => handlePreviewFile(path)}
                    disabled={loading}
                  >
                    {path}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="muted small">Select a session to load git status.</p>
          )}

          <h3>File Preview</h3>
          <input
            value={selectedFile}
            onChange={(event) => setSelectedFile(event.target.value)}
            placeholder="relative/path.py"
            disabled={loading}
          />
          <button type="button" onClick={() => handlePreviewFile(selectedFile)} disabled={!selectedFile || loading}>
            Load Preview
          </button>
        </aside>

        <section className="workspace-chat card">
          <h2>Chat</h2>
          <div className="chat-log">
            {messages.length === 0 ? <p className="muted">No messages yet. Ask for an edit or review.</p> : null}
            {messages.map((message) => (
              <article key={message.id} className={`chat-bubble chat-${message.role}`}>
                <strong>{message.role}</strong>
                <pre>{message.content || (loading ? "…" : "")}</pre>
              </article>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-form" onSubmit={handleSend}>
            <textarea
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask CodeForge to edit, explain, or review your project…"
              disabled={!token || !sessionId || loading}
            />
            <button type="submit" disabled={!canSend}>
              {loading ? "Working…" : "Send"}
            </button>
          </form>
        </section>

        <aside className="workspace-review card">
          <h2>Review</h2>
          {pendingProposal ? (
            <div className="preview-box">
              <p>
                <strong>{pendingProposal.target_file}</strong>
              </p>
              <p className="muted small">status: {pendingProposal.status || "pending"}</p>
              <pre className="diff-preview">{pendingProposal.patch_preview || "(no diff preview)"}</pre>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => handleProposalDecision("approve")}
                  disabled={loading || pendingProposal.status === "approved"}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleProposalDecision("reject")}
                  disabled={loading || pendingProposal.status === "rejected"}
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <p className="muted small">Proposals appear here after agent runs.</p>
          )}

          {filePreview ? (
            <div className="preview-box">
              <p className="small">
                <strong>Preview:</strong> {selectedFile}
              </p>
              <pre className="diff-preview">{filePreview}</pre>
            </div>
          ) : null}

          {gitDiff ? (
            <div className="preview-box">
              <p className="small">
                <strong>Git diff:</strong> {selectedFile}
              </p>
              <pre className="diff-preview">{gitDiff}</pre>
            </div>
          ) : null}

          <h3>Activity</h3>
          <ul className="activity-list">
            {activity.length === 0 ? <li className="muted">No events yet.</li> : null}
            {activity.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="workspace-tools card workspace-tools-wide">
        <div className="tool-panel">
          <h3>Workflows</h3>
          <div className="button-row">
            <button type="button" onClick={handleCompact} disabled={!token || !sessionId || loading}>
              Compact
            </button>
            <button type="button" onClick={handleUltrareview} disabled={!token || !sessionId || loading}>
              Ultrareview
            </button>
            <button type="button" onClick={handleForkSession} disabled={!token || !sessionId || loading}>
              Fork
            </button>
          </div>
          <input
            value={planTargets}
            onChange={(event) => setPlanTargets(event.target.value)}
            placeholder="plan targets: file1.py file2.py"
            disabled={loading}
          />
          <label className="small">
            <input
              type="checkbox"
              checked={autoMode}
              onChange={(event) => setAutoMode(event.target.checked)}
              disabled={loading}
            />{" "}
            Auto mode
          </label>
          <div className="button-row">
            <button type="button" onClick={handleCreatePlan} disabled={!token || !sessionId || loading}>
              Plan
            </button>
            <button type="button" onClick={handleExecutePlan} disabled={!activePlanId || loading}>
              Run Plan
            </button>
            <button type="button" onClick={handleRollbackPlan} disabled={!activePlanId || loading}>
              Rollback
            </button>
          </div>
          {workflowOutput ? <pre className="shell-output">{workflowOutput}</pre> : null}
          <h4 className="small">Agent templates</h4>
          <select
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
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="template name"
            disabled={loading}
          />
          <textarea
            rows={3}
            value={templatePrefix}
            onChange={(event) => setTemplatePrefix(event.target.value)}
            placeholder="prompt prefix"
            disabled={loading}
          />
          <button type="button" onClick={handleCreateTemplate} disabled={!token || loading}>
            Save template
          </button>
          <h4 className="small">Artifacts</h4>
          {artifacts.length === 0 ? (
            <p className="muted small">No artifacts yet.</p>
          ) : (
            <div className="button-row">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.artifact_id}
                  type="button"
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
              className="artifact-preview-frame"
              sandbox="allow-scripts"
              srcDoc={artifactPreviewHtml}
            />
          ) : null}
        </div>
        <div className="tool-panel">
          <h3>Shell</h3>
          <div className="button-row">
            <input
              value={shellCommand}
              onChange={(event) => setShellCommand(event.target.value)}
              disabled={loading}
            />
            <button type="button" onClick={handleRunShell} disabled={!token || !sessionId || loading}>
              Run
            </button>
          </div>
          {shellOutput ? <pre className="shell-output">{shellOutput}</pre> : null}
        </div>
        <div className="tool-panel">
          <h3>Verify / Fix Loop</h3>
          <div className="button-row">
            <input
              value={loopVerify}
              onChange={(event) => setLoopVerify(event.target.value)}
              disabled={loopRunning || loading}
              placeholder="pytest -q"
            />
            <button
              type="button"
              onClick={handleRunLoop}
              disabled={!token || !sessionId || loopRunning || loading}
            >
              {loopRunning ? "Loop running…" : "Run Loop"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
