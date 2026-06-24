"use client";

export default function ParallelSessionsBar({ sessions, activeSessionId, onSelect, onFork, loading, disabled }) {
  if (!sessions?.length) {
    return null;
  }

  return (
    <div className="parallel-sessions-bar" aria-label="Parallel agent sessions">
      <span className="small parallel-sessions-label">Parallel sessions</span>
      <div className="parallel-sessions-tabs">
        {sessions.map((item) => (
          <button
            key={item.sessionId}
            type="button"
            className={`ghost-btn small ${item.sessionId === activeSessionId ? "ghost-btn-active" : ""}`}
            onClick={() => onSelect(item.sessionId)}
            disabled={loading}
          >
            {item.label}
          </button>
        ))}
        <button type="button" className="ghost-btn small" onClick={onFork} disabled={disabled || loading}>
          + Fork
        </button>
      </div>
    </div>
  );
}
