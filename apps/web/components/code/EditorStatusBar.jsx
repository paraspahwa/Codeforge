"use client";

import { languageForPath } from "../../lib/editor-language";

export default function EditorStatusBar({
  path,
  cursor,
  branch,
  dirty,
  panel,
  onTogglePanel,
  problemCount = 0,
  remoteLabel,
  indentSize = 2,
  onOpenProblems,
}) {
  const language = languageForPath(path);

  return (
    <footer className="ide-status-bar">
      <div className="ide-status-left">
        {remoteLabel ? <span className="ide-status-item ide-status-remote">{remoteLabel}</span> : null}
        {branch ? (
          <span className="ide-status-item">
            ⎇ {branch}
            {dirty ? "*" : ""}
          </span>
        ) : null}
        <button
          type="button"
          className={`ide-status-btn ${problemCount > 0 ? "ide-status-errors" : ""}`}
          onClick={onOpenProblems}
        >
          {problemCount > 0 ? `⨯ ${problemCount}` : "✓ 0"}
        </button>
        {dirty ? <span className="ide-status-item ide-status-dirty">Unsaved</span> : null}
      </div>
      <div className="ide-status-right">
        {path ? (
          <>
            <span className="ide-status-item">
              Ln {cursor.lineNumber}, Col {cursor.column}
            </span>
            <span className="ide-status-item">Spaces: {indentSize}</span>
            <span className="ide-status-item">UTF-8</span>
            <span className="ide-status-item">LF</span>
            <span className="ide-status-item">{language}</span>
          </>
        ) : null}
        <button type="button" className="ide-status-btn" onClick={onTogglePanel}>
          Panel {panel === "hidden" ? "▸" : "▾"}
        </button>
      </div>
    </footer>
  );
}
