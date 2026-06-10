"use client";

export default function ConflictAssistant({
  show,
  onToggle,
  conflictTargetBranch,
  onConflictTargetBranchChange,
  conflictGuide,
  conflictStrategy,
  onConflictStrategyChange,
  conflictPaths,
  onConflictPathsChange,
  sessionId,
  loading,
  sessionWritable,
  onLoadGuide,
  onApply,
}) {
  return (
    <>
      <hr className="divider" />
      <button type="button" className="ghost-btn" onClick={onToggle}>
        {show ? "Hide" : "Show"} Git Conflict Assistant
      </button>
      {show ? (
        <div className="mt-8">
          <input
            value={conflictTargetBranch}
            onChange={(event) => onConflictTargetBranchChange(event.target.value)}
            disabled={loading}
            placeholder="Target branch"
          />
          <div className="mt-6">
            <button type="button" onClick={onLoadGuide} disabled={!sessionId || loading}>
              Load Conflict Guide
            </button>
          </div>
          {conflictGuide ? (
            <>
              <p className="small">Conflicts: {(conflictGuide.conflict_files || []).length}</p>
              <select
                value={conflictStrategy}
                onChange={(event) => onConflictStrategyChange(event.target.value)}
                disabled={loading}
              >
                <option value="ours">ours</option>
                <option value="theirs">theirs</option>
              </select>
              <textarea
                rows={4}
                value={conflictPaths}
                onChange={(event) => onConflictPathsChange(event.target.value)}
                disabled={loading}
              />
              <div className="mt-6">
                <button type="button" onClick={onApply} disabled={loading || !sessionWritable}>
                  Apply Strategy and Stage
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
