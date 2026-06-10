"use client";

import { Badge, Button } from "@codeforge/ui";

import { formatSessionListLabel } from "@codeforge/shared/sessions";

export default function SessionSidebar({
  projectPath,
  onProjectPathChange,
  onCreateSession,
  sessionId,
  sessionHistory,
  onSelectSession,
  loading,
  usage,
  lastModel,
  sessionFilter,
  onSessionFilterChange,
  sessionWritable,
  currentSession,
}) {
  const filtered = sessionHistory.filter((entry) => {
    if (!sessionFilter.trim()) {
      return true;
    }
    const needle = sessionFilter.toLowerCase();
    return (
      entry.session_id.toLowerCase().includes(needle) ||
      (entry.project_path || "").toLowerCase().includes(needle)
    );
  });

  return (
    <section className="panel">
      <h2>Session</h2>
      <label className="small" htmlFor="projectPath">
        Project Path
      </label>
      <input
        id="projectPath"
        value={projectPath}
        placeholder="c:/path/to/your/project"
        onChange={(event) => onProjectPathChange(event.target.value)}
        disabled={loading}
      />
      <div className="mt-8">
        <Button type="button" onClick={onCreateSession} disabled={loading || !projectPath.trim()}>
          {sessionId ? "New Session" : "Create Session"}
        </Button>
      </div>
      <p className="small mt-8">Active: {sessionId ?? "none"}</p>
      {!sessionWritable && currentSession ? (
        <Badge variant="warning">View-only grant</Badge>
      ) : null}
      <p className="small">Last model: {lastModel}</p>
      {usage ? (
        <p className="small">
          {usage.requests_used_in_period ?? usage.total_requests} requests ({usage.requests_remaining} left)
        </p>
      ) : null}
      <h3>Sessions</h3>
      <input
        aria-label="Filter sessions"
        placeholder="Search sessions..."
        value={sessionFilter}
        onChange={(event) => onSessionFilterChange(event.target.value)}
        disabled={loading}
      />
      <div className="session-list session-list-tall">
        {filtered.length === 0 ? <p className="small">No sessions found.</p> : null}
        {filtered.map((entry) => (
          <button
            key={entry.session_id}
            className={`ghost-btn ${entry.session_id === sessionId ? "ghost-btn-active" : ""}`}
            type="button"
            onClick={() => onSelectSession(entry.session_id)}
            disabled={loading}
          >
            <span>{formatSessionListLabel(entry)}</span>
            <span className="small block">{new Date(entry.created_at).toLocaleString()}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
