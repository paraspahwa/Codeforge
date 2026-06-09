"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyGitConflictAssist,
  createSession,
  decideProposal,
  getGitConflictGuide,
  getProposal,
  getUsageSummary,
  listMessages,
  listSessions,
  sendMessage,
  streamSession,
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
    // toast is stable; refresh only when auth changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

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
      const sent = await sendMessage(sessionId, userText, token);
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
          source.close();
          getUsageSummary(token).then(setUsage).catch(() => undefined);
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
              <span>{entry.session_id}</span>
              <span className="small"> {new Date(entry.created_at).toLocaleString()}</span>
            </button>
          ))}
        </div>

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
