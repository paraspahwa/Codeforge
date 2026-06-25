"use client";

const DEFAULT_LAUNCH_CONFIGS = [
  { name: "Python: Current file", command: "python ${file}" },
  { name: "Node: Current file", command: "node ${file}" },
  { name: "npm test", command: "npm test" },
  { name: "pytest", command: "pytest -q" },
];

export default function RunPanel({
  loopVerify,
  onLoopVerifyChange,
  onRunLoop,
  loopRunning,
  onRunShell,
  shellCommand,
  onShellCommandChange,
  launchConfigs = DEFAULT_LAUNCH_CONFIGS,
  onRunLaunch,
  localMode = false,
  onRunFile,
}) {
  return (
    <div className="ide-sidebar-content ide-run-panel">
      <h3>Run and Debug</h3>
      {localMode ? (
        <section className="ide-panel-section">
          <p className="small muted">Execute the active file — JavaScript logs to Output; HTML opens live preview.</p>
          <button type="button" className="ide-run-primary-btn" onClick={onRunFile}>
            Run active file
          </button>
        </section>
      ) : (
        <p className="small muted">Agent verify loops, launch configs, and quick commands.</p>
      )}

      <section className="ide-panel-section">
        <h4 className="ide-panel-section-title">launch.json</h4>
        <ul className="ide-launch-list">
          {launchConfigs.map((config) => (
            <li key={config.name}>
              <button type="button" className="ide-launch-item" onClick={() => onRunLaunch?.(config)}>
                <span className="ide-launch-icon">▶</span>
                <span>{config.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {!localMode ? (
          <p className="small muted">Reads workspace `.vscode/launch.json` when present; defaults shown above.</p>
        ) : null}
      </section>

      {!localMode ? (
        <>
          <section className="ide-panel-section">
            <h4 className="ide-panel-section-title">Verify loop</h4>
            <label className="small">
              Verify command
              <input value={loopVerify} onChange={(event) => onLoopVerifyChange(event.target.value)} disabled={loopRunning} />
            </label>
            <button type="button" onClick={onRunLoop} disabled={loopRunning}>
              {loopRunning ? "Running loop…" : "Run agent verify loop"}
            </button>
          </section>

          <section className="ide-panel-section">
            <h4 className="ide-panel-section-title">Quick run</h4>
            <label className="small">
              Command
              <input value={shellCommand} onChange={(event) => onShellCommandChange(event.target.value)} />
            </label>
            <button type="button" className="ghost-btn" onClick={onRunShell}>
              Run in terminal
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
