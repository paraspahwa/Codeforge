import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { formatEvent } from "@codeforge/shared/sse";
import {
  createSession,
  decideProposal,
  devLogin,
  getFilePreview,
  getGitDiff,
  getGitStatus,
  getProposal,
  getUsageSummary,
  listMessages,
  listSessions,
  runAgentLoop,
  sendMessage,
  streamSessionEvents,
  streamShellCommand,
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
  const stored = useMemo(() => loadStoredState(), []);

  const [userId, setUserId] = useState(import.meta.env.VITE_CODEFORGE_USER_ID || stored.userId || "dev-user");
  const [projectPath, setProjectPath] = useState(import.meta.env.VITE_CODEFORGE_PROJECT_PATH || stored.projectPath || "");
  const [token, setToken] = useState(stored.token || null);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(stored.sessionId || "");
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastModel, setLastModel] = useState("-");
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
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const chatEndRef = useRef(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === sessionId) || null,
    [sessionId, sessions],
  );

  const canSend = Boolean(token && sessionId && prompt.trim() && !loading);

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

  async function handleLogin() {
    setLoading(true);
    setErrorMessage("");
    try {
      const nextToken = await devLogin(userId.trim());
      setToken(nextToken);
      saveStoredState({ userId: userId.trim(), token: nextToken });
      await refreshSessions(nextToken);
      await refreshUsage(nextToken);
      setStatusMessage(`Logged in as ${userId.trim()}`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
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
      const sent = await sendMessage(token, sessionId, userText, projectPath, selectedFile || null);
      setLastModel(sent.model_used ?? "-");
      pushActivity([
        `route: ${sent.intent ?? "unknown"} via ${sent.model_used ?? "unknown"}`,
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
  }, [token]);

  useEffect(() => {
    if (!token || !sessionId) {
      return;
    }
    refreshGit(token, sessionId).catch(() => null);
  }, [token, sessionId]);

  useEffect(() => {
    saveStoredState({ userId, projectPath, sessionId });
  }, [userId, projectPath, sessionId]);

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

      {statusMessage ? <div className="status success">{statusMessage}</div> : null}
      {errorMessage ? <div className="status error">{errorMessage}</div> : null}

      <section className="workspace-toolbar card">
        <div className="toolbar-group">
          <label htmlFor="code-uid">User</label>
          <input id="code-uid" value={userId} onChange={(event) => setUserId(event.target.value)} disabled={loading} />
          <button type="button" onClick={handleLogin} disabled={!userId.trim() || loading}>
            {token ? "Re-login" : "Login"}
          </button>
        </div>
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
                {session.session_id}
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

      <section className="workspace-tools card">
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
