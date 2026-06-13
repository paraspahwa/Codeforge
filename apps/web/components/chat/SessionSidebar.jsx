"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@codeforge/ui";

import { formatSessionListLabel } from "@codeforge/shared/sessions";

import AgentMascot from "./AgentMascot";

const WORKSPACE_PRESETS = [
  { label: "Demo project", path: "/workspaces/demo" },
  { label: "Main workspace", path: "/workspaces/main" },
];

const FEATURE_LINKS = [
  { href: "/code", label: "Code editor", icon: "⌨️" },
  { href: "/sessions", label: "Sessions", icon: "🗂️" },
  { href: "/cowork", label: "Cowork", icon: "🤝" },
  { href: "/team", label: "Team", icon: "👥" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/billing", label: "Billing", icon: "💳" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
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
  const pathname = usePathname();

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
    <aside className="agent-sidebar">
      <AgentMascot state={mascotState} />

      <div className="agent-sidebar-header">
        <h2>Workspace</h2>
        <p className="small">Point the agent at a folder inside the server.</p>
      </div>

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

      <label className="small" htmlFor="projectPath">
        Project path
      </label>
      <input
        id="projectPath"
        className="agent-input"
        value={projectPath}
        placeholder="/workspaces/demo"
        onChange={(event) => onProjectPathChange(event.target.value)}
        disabled={loading}
      />

      <Button type="button" className="agent-primary-btn" onClick={onCreateSession} disabled={loading || !projectPath.trim()}>
        {loading ? "Starting…" : sessionId ? "+ New chat" : "Start coding"}
      </Button>

      {sessionId ? (
        <p className="small agent-meta">Session active — changes apply automatically.</p>
      ) : (
        <p className="small agent-meta">Create a session to send your first message.</p>
      )}

      <div className="agent-sidebar-divider" />

      <div className="agent-sidebar-header">
        <h3>Features</h3>
      </div>
      <div className="agent-feature-grid">
        {FEATURE_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`agent-feature-link ${pathname === item.href ? "agent-feature-link-active" : ""}`}
          >
            <span aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="agent-sidebar-divider" />

      <div className="agent-sidebar-header">
        <h3>Recent chats</h3>
      </div>
      <input
        aria-label="Filter chats"
        className="agent-input"
        placeholder="Filter…"
        value={sessionFilter}
        onChange={(event) => onSessionFilterChange(event.target.value)}
        disabled={loading}
      />
      <div className="agent-session-list">
        {filtered.length === 0 ? <p className="small">No chats yet.</p> : null}
        {filtered.map((entry) => (
          <button
            key={entry.session_id}
            className={`agent-session-item ${entry.session_id === sessionId ? "agent-session-item-active" : ""}`}
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
