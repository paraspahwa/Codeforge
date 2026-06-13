"use client";

import { useState } from "react";

export default function ScmPanel({ gitStatus, changedFiles, onOpenFile, onStage, onRefresh, loading, onCommitted }) {
  const [commitMessage, setCommitMessage] = useState("");

  async function handleCommit() {
    if (!commitMessage.trim() || changedFiles.length === 0) {
      return;
    }
    await onStage?.({
      message: commitMessage.trim(),
      paths: changedFiles.map((f) => f.path || f),
    });
    setCommitMessage("");
    onCommitted?.();
  }

  return (
    <div className="ide-scm-panel">
      <div className="ide-scm-header">
        <h3>Source Control</h3>
        <button type="button" className="ghost-btn small" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </div>
      {gitStatus ? (
        <p className="small">
          <strong>{gitStatus.branch}</strong> · {gitStatus.clean ? "clean" : "dirty"}
        </p>
      ) : (
        <p className="small muted">Connect a session to view git status.</p>
      )}
      <textarea
        rows={2}
        className="ide-scm-commit-input"
        value={commitMessage}
        onChange={(event) => setCommitMessage(event.target.value)}
        placeholder="Commit message"
        disabled={loading}
      />
      <button
        type="button"
        className="small"
        disabled={loading || !commitMessage.trim() || changedFiles.length === 0}
        onClick={handleCommit}
      >
        Stage &amp; commit
      </button>
      <ul className="ide-scm-changes">
        {changedFiles.length === 0 ? (
          <li className="small muted">No changes.</li>
        ) : (
          changedFiles.map((item) => {
            const path = item.path || item;
            return (
              <li key={path}>
                <button type="button" className="code-file-btn" onClick={() => onOpenFile(path)} disabled={loading}>
                  {item.status || "M"} {path}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
