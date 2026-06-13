"use client";

import Link from "next/link";

import { Button } from "@codeforge/ui";

import { formatSessionListLabel } from "@codeforge/shared/sessions";

import AgentMascot from "./AgentMascot";

const WORKSPACE_PRESETS = [
  { label: "Demo project", path: "/workspaces/demo" },
  { label: "Main workspace", path: "/workspaces/main" },
];

export default function SessionSidebar({
  projectPath,
  onProjectPathChange,
  onCreateSession,
  sessionId,
  sessionHistory,
  onSelectSession,
  loading,
  sessionFilter,
  onSessionFilterChange,
  mascotState = "idle",
}) {
  const filtered = sessionHistory.filter((entry) => {
    if (!sessionFilter.trim()) {
      return true;
    }
    const needle = sessionFilter.toLowerCase();
    return (
      entry.session_id.toLowerCase().includes(needle) ||
      (entry.summary || "").toLowerCase().includes(needle) ||
      (entry.project_path || "").toLowerCase().includes(needle)
    );
  });

  return (
    <aside className="agent-sidebar">
      <AgentMascot state={mascotState} />

      <div className="agent-sidebar-header cf-animate-in">
        <h2>Your project</h2>
        <p className="small">Where your app files live — pick a preset or type a folder.</p>
      </div>

      <div className="workspace-presets">
        {WORKSPACE_PRESETS.map((preset) => (
          <button
            key={preset.path}
            type="button"
            className={`workspace-preset cf-hover-lift ${projectPath === preset.path ? "workspace-preset-active" : ""}`}
            onClick={() => onProjectPathChange(preset.path)}
            disabled={loading}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <label className="small" htmlFor="projectPath">
        Project folder
      </label>
      <input
        id="projectPath"
        className="agent-input"
        value={projectPath}
        placeholder="/workspaces/demo"
        onChange={(event) => onProjectPathChange(event.target.value)}
        disabled={loading}
      />

      <Button type="button" className="agent-primary-btn cf-shimmer-btn" onClick={onCreateSession} disabled={loading || !projectPath.trim()}>
        {loading ? "Starting…" : sessionId ? "+ New chat" : "Start a new chat"}
      </Button>

      <Link href="/features" className="agent-features-link cf-hover-lift">
        <span aria-hidden>✨</span> Explore all features
      </Link>

      {sessionId ? (
        <p className="small agent-meta">Chat active — the AI handles the technical work.</p>
      ) : (
        <p className="small agent-meta">Start a chat and describe what you want to build.</p>
      )}

      <div className="agent-sidebar-divider" />

      <div className="agent-sidebar-header">
        <h3>Recent chats</h3>
      </div>
      <input
        aria-label="Filter chats"
        className="agent-input"
        placeholder="Search chats…"
        value={sessionFilter}
        onChange={(event) => onSessionFilterChange(event.target.value)}
        disabled={loading}
      />
      <div className="agent-session-list">
        {filtered.length === 0 ? <p className="small">No chats yet — start one above!</p> : null}
        {filtered.map((entry, index) => (
          <button
            key={entry.session_id}
            className={`agent-session-item cf-animate-in cf-hover-lift ${entry.session_id === sessionId ? "agent-session-item-active" : ""}`}
            style={{ animationDelay: `${index * 40}ms` }}
            type="button"
            onClick={() => onSelectSession(entry.session_id)}
            disabled={loading}
          >
            <span className="agent-session-title">{formatSessionListLabel(entry)}</span>
            <span className="small">{new Date(entry.created_at).toLocaleString()}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
