"use client";

import { useEffect, useState } from "react";

import {
  createSessionShare,
  exportSession,
  listMessages,
  listSessions,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

export default function SessionsPage() {
  const { token, ready } = useAuth();
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [replayMessages, setReplayMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState("json");
  const [shareAccess, setShareAccess] = useState("view");
  const [shareExpiry, setShareExpiry] = useState(72);
  const [shareResult, setShareResult] = useState(null);

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

  async function handleSelect(sessionId) {
    setLoading(true);
    setShareResult(null);
    try {
      const messages = await listMessages(sessionId, token);
      setSelectedSession(sessionId);
      setReplayMessages(messages);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
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
              <span>{entry.session_id}</span>
              <span className="small"> {new Date(entry.created_at).toLocaleString()}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Replay {selectedSession ? `- ${selectedSession}` : ""}</h2>
        {!selectedSession ? <p className="small">Select a session to replay its conversation.</p> : null}

        {selectedSession ? (
          <>
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

            <div className="chat-log chat-log-tall mt-8">
              {replayMessages.length === 0 ? <p className="small">This session has no messages.</p> : null}
              {replayMessages.map((msg) => (
                <div className={`msg ${msg.role}`} key={msg.message_id}>
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
