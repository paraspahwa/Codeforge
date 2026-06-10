"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatSessionListLabel } from "@codeforge/shared/sessions";
import {
  createSessionShare,
  exportSession,
  listMessages,
  listProposals,
  listSessions,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

const REPLAY_INTERVAL_MS = 2200;

export default function SessionsPage() {
  const { token, ready } = useAuth();
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [replayMessages, setReplayMessages] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState("json");
  const [shareAccess, setShareAccess] = useState("view");
  const [shareExpiry, setShareExpiry] = useState(72);
  const [shareResult, setShareResult] = useState(null);
  const playTimerRef = useRef(null);

  const selectedMeta = useMemo(
    () => sessions.find((entry) => entry.session_id === selectedSession) || null,
    [selectedSession, sessions],
  );

  const visibleMessages = useMemo(() => {
    if (replayMessages.length === 0) {
      return [];
    }
    return replayMessages.slice(0, replayIndex + 1);
  }, [replayIndex, replayMessages]);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    setLoading(true);
    listSessions(token)
      .then(setSessions)
      .catch((error) => toast.push(error.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  useEffect(() => {
    return () => {
      if (playTimerRef.current) {
        window.clearInterval(playTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!playing || replayMessages.length === 0) {
      if (playTimerRef.current) {
        window.clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }

    playTimerRef.current = window.setInterval(() => {
      setReplayIndex((previous) => {
        if (previous >= replayMessages.length - 1) {
          setPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, REPLAY_INTERVAL_MS);

    return () => {
      if (playTimerRef.current) {
        window.clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [playing, replayMessages.length]);

  async function handleSelect(sessionId) {
    setLoading(true);
    setShareResult(null);
    setPlaying(false);
    try {
      const [messages, sessionProposals] = await Promise.all([
        listMessages(sessionId, token),
        listProposals(sessionId, token),
      ]);
      setSelectedSession(sessionId);
      setReplayMessages(messages);
      setProposals(sessionProposals);
      setReplayIndex(messages.length > 0 ? 0 : -1);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReplayFirst() {
    setPlaying(false);
    setReplayIndex(replayMessages.length > 0 ? 0 : -1);
  }

  function handleReplayPrev() {
    setPlaying(false);
    setReplayIndex((previous) => Math.max(0, previous - 1));
  }

  function handleReplayNext() {
    setPlaying(false);
    setReplayIndex((previous) => Math.min(replayMessages.length - 1, previous + 1));
  }

  function handleReplayLast() {
    setPlaying(false);
    setReplayIndex(Math.max(0, replayMessages.length - 1));
  }

  function handleTogglePlay() {
    if (replayMessages.length === 0) {
      return;
    }
    if (replayIndex >= replayMessages.length - 1) {
      setReplayIndex(0);
    }
    setPlaying((previous) => !previous);
  }

  function handleResumeInChat() {
    if (!selectedSession) {
      return;
    }
    if (selectedMeta?.project_path) {
      localStorage.setItem("codeforge_project_path", selectedMeta.project_path);
    }
    localStorage.setItem("codeforge_resume_session", selectedSession);
    toast.push("Opening chat with this session", "success");
  }

  async function handleExport() {
    if (!selectedSession) {
      return;
    }
    setLoading(true);
    try {
      const result = await exportSession(selectedSession, token, exportFormat);
      const blob = new Blob([result.content], {
        type: exportFormat === "json" ? "application/json" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedSession}.${exportFormat === "json" ? "json" : "md"}`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.push("Export downloaded", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!selectedSession) {
      return;
    }
    setLoading(true);
    try {
      const share = await createSessionShare(token, selectedSession, shareAccess, Number(shareExpiry));
      setShareResult(share);
      try {
        await navigator.clipboard.writeText(share.share_url);
        toast.push("Share link copied to clipboard", "success");
      } catch {
        toast.push("Share link created", "success");
      }
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (ready && !token) {
    return (
      <section className="panel empty-state">
        <h2>Sessions</h2>
        <p className="small">Login from the top bar to browse your session history.</p>
      </section>
    );
  }

  return (
    <div className="two-col">
      <section className="panel">
        <h2>Session History</h2>
        {loading && sessions.length === 0 ? <p className="small">Loading...</p> : null}
        {!loading && sessions.length === 0 ? <p className="small">No sessions yet.</p> : null}
        <div className="session-list session-list-tall">
          {sessions.map((entry) => (
            <button
              key={entry.session_id}
              className={`ghost-btn ${entry.session_id === selectedSession ? "ghost-btn-active" : ""}`}
              type="button"
              onClick={() => handleSelect(entry.session_id)}
              disabled={loading}
            >
              <span>{formatSessionListLabel(entry)}</span>
              <span className="small"> {new Date(entry.created_at).toLocaleString()}</span>
              {entry.project_path ? <span className="small block">{entry.project_path}</span> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Replay {selectedSession ? `- ${selectedSession}` : ""}</h2>
        {!selectedSession ? <p className="small">Select a session to replay its conversation.</p> : null}

        {selectedSession ? (
          <>
            {selectedMeta ? (
              <div className="order-card mt-8">
                <div className="small">
                  <strong>Project:</strong> {selectedMeta.project_path}
                </div>
                <div className="small">
                  <strong>Created:</strong> {new Date(selectedMeta.created_at).toLocaleString()}
                </div>
                <div className="small">
                  <strong>Messages:</strong> {replayMessages.length} · <strong>Proposals:</strong> {proposals.length}
                </div>
              </div>
            ) : null}

            <div className="replay-toolbar mt-8">
              <button type="button" onClick={handleReplayFirst} disabled={loading || replayMessages.length === 0}>
                First
              </button>
              <button type="button" onClick={handleReplayPrev} disabled={loading || replayIndex <= 0}>
                Prev
              </button>
              <button type="button" onClick={handleTogglePlay} disabled={loading || replayMessages.length === 0}>
                {playing ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={handleReplayNext}
                disabled={loading || replayIndex >= replayMessages.length - 1}
              >
                Next
              </button>
              <button type="button" onClick={handleReplayLast} disabled={loading || replayMessages.length === 0}>
                Last
              </button>
              <span className="small replay-progress">
                {replayMessages.length > 0
                  ? `Step ${replayIndex + 1} / ${replayMessages.length}`
                  : "No messages"}
              </span>
              <Link href="/" className="ghost-btn inline-btn" onClick={handleResumeInChat}>
                Resume in Chat
              </Link>
            </div>

            <div className="replay-toolbar">
              <select
                aria-label="Export format"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value)}
                disabled={loading}
              >
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
              </select>
              <button type="button" onClick={handleExport} disabled={loading}>
                Export
              </button>
              <select
                aria-label="Share access level"
                value={shareAccess}
                onChange={(event) => setShareAccess(event.target.value)}
                disabled={loading}
              >
                <option value="view">view</option>
                <option value="comment">comment</option>
              </select>
              <select
                aria-label="Share expiry"
                value={shareExpiry}
                onChange={(event) => setShareExpiry(event.target.value)}
                disabled={loading}
              >
                <option value={24}>24h</option>
                <option value={72}>72h</option>
                <option value={168}>7 days</option>
              </select>
              <button type="button" onClick={handleShare} disabled={loading}>
                Share
              </button>
            </div>

            {shareResult ? (
              <div className="order-card mt-8">
                <div className="small">Share URL: {shareResult.share_url}</div>
                <div className="small">
                  Access: {shareResult.access_level} | Expires:{" "}
                  {new Date(shareResult.expires_at).toLocaleString()}
                </div>
              </div>
            ) : null}

            {proposals.length > 0 ? (
              <div className="mt-8">
                <h3>Proposals</h3>
                <div className="proposal-replay-list">
                  {proposals.map((proposal) => (
                    <details key={proposal.proposal_id} className="proposal-replay-item">
                      <summary>
                        {proposal.target_file} · {proposal.status} · {proposal.proposal_id}
                      </summary>
                      <pre className="msg-content">{proposal.patch_preview || "(no preview)"}</pre>
                    </details>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="chat-log chat-log-tall mt-8">
              {replayMessages.length === 0 ? <p className="small">This session has no messages.</p> : null}
              {visibleMessages.map((msg, index) => (
                <div
                  className={`msg ${msg.role} ${index === replayIndex ? "msg-active" : ""}`}
                  key={msg.message_id}
                >
                  <strong>{msg.role === "user" ? "User" : "CodeForge"}</strong>
                  <div className="msg-content">{msg.content}</div>
                  {msg.created_at ? (
                    <div className="small">{new Date(msg.created_at).toLocaleString()}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
