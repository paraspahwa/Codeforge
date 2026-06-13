"use client";

import { useEffect, useState } from "react";

export default function TimelinePanel({ sessionId, activePath, onLoadGitLog, onOpenAt }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId || !onLoadGitLog) {
      setEntries([]);
      return;
    }
    setLoading(true);
    onLoadGitLog(15)
      .then((result) => {
        const commits = result?.commits || result?.entries || [];
        setEntries(Array.isArray(commits) ? commits : []);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [sessionId, activePath, onLoadGitLog]);

  return (
    <section className="ide-timeline-panel">
      <h4 className="ide-panel-section-title">Timeline</h4>
      {activePath ? <p className="small muted">{activePath}</p> : null}
      {loading ? <p className="small muted">Loading git history…</p> : null}
      {!loading && entries.length === 0 ? <p className="small muted">No timeline entries.</p> : null}
      <ul className="ide-timeline-list">
        {entries.map((entry, index) => (
          <li key={entry.hash || entry.id || index}>
            <button
              type="button"
              className="ide-timeline-item"
              onClick={() => activePath && onOpenAt?.(activePath, 1)}
              title={entry.message || entry.subject}
            >
              <span className="ide-timeline-hash">{(entry.hash || entry.sha || "").slice(0, 7)}</span>
              <span>{entry.message || entry.subject || "commit"}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
