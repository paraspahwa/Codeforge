"use client";

import { formatSessionListLabel } from "@codeforge/shared/sessions";
import { Icon } from "@codeforge/ui";

import AgentMascot from "./AgentMascot";
import AgentPicker from "./AgentPicker";

const WORKSPACE_PRESETS = [
  { label: "Demo", path: "/workspaces/demo" },
  { label: "Main", path: "/workspaces/main" },
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
  agents = [],
  selectedAgent,
  onSelectAgent,
}) {
  const isActiveChat = Boolean(sessionId);

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
    <aside className={`cf-session-rail agent-sidebar ${isActiveChat ? "agent-sidebar-compact" : ""}`}>
      {!isActiveChat ? (
        <>
          <AgentMascot state={mascotState} />
          <div className="cf-session-welcome">
            <h2>Workspace</h2>
            <p>Pick a folder, choose an agent, and start building.</p>
          </div>
        </>
      ) : null}

      <div className="cf-session-rail-toolbar">
        <button
          type="button"
          className="cf-btn-primary"
          onClick={onCreateSession}
          disabled={loading || !projectPath.trim()}
          title="Start a new chat"
        >
          <Icon name="Plus" size={14} />
          {loading ? "Starting…" : "New chat"}
        </button>
        <details className="cf-project-popover">
          <summary className="cf-icon-btn cf-project-summary" title="Project folder" aria-label="Project folder">
            <Icon name="Folder" size={16} />
          </summary>
          <div className="cf-project-popover-panel">
            <div className="workspace-presets">
              {WORKSPACE_PRESETS.map((preset) => (
                <button
                  key={preset.path}
                  type="button"
                  className={`workspace-preset ${projectPath === preset.path ? "workspace-preset-active" : ""}`}
                  onClick={() => onProjectPathChange(preset.path)}
                  disabled={loading}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label htmlFor="projectPath">Folder</label>
            <input
              id="projectPath"
              className="agent-input"
              value={projectPath}
              placeholder="/workspaces/main"
              onChange={(event) => onProjectPathChange(event.target.value)}
              disabled={loading}
            />
          </div>
        </details>
      </div>

      <AgentPicker
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={onSelectAgent}
        loading={loading}
        compact={isActiveChat}
      />

      <div className="cf-session-rail-section">
        <p className="cf-session-rail-heading">Recent</p>
        <div className="cf-search-field">
          <Icon name="Search" size={14} />
          <input
            aria-label="Search chats"
            placeholder="Search chats…"
            value={sessionFilter}
            onChange={(event) => onSessionFilterChange(event.target.value)}
            disabled={loading}
          />
        </div>
        <div className="agent-session-list">
          {filtered.length === 0 ? <p className="small" style={{ color: "var(--cf-muted)", padding: "0.5rem" }}>No chats yet</p> : null}
          {filtered.map((entry) => (
            <button
              key={entry.session_id}
              type="button"
              className={`agent-session-item ${entry.session_id === sessionId ? "agent-session-item-active" : ""}`}
              onClick={() => onSelectSession(entry.session_id)}
              disabled={loading}
            >
              <span className="agent-session-title">{formatSessionListLabel(entry)}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
