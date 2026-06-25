"use client";

export default function ParallelSessionsBar({
  sessions,
  activeSessionId,
  onSelect,
  onFork,
  loading,
  disabled,
  compact = false,
}) {
  if (!sessions?.length) {
    return null;
  }

  if (compact) {
    return (
      <div className="parallel-sessions-inline" aria-label="Parallel agent sessions">
        {sessions.map((item) => (
          <button
            key={item.sessionId}
            type="button"
            className={`cf-status-pill cf-status-pill-subtle ${item.sessionId === activeSessionId ? "is-active" : ""}`}
            onClick={() => onSelect(item.sessionId)}
            disabled={loading}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="cf-status-pill cf-status-pill-subtle"
          onClick={onFork}
          disabled={disabled || loading}
        >
          + Fork
        </button>
      </div>
    );
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
