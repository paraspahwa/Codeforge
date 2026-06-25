"use client";

import IdeTerminal from "../code/IdeTerminal";
import LocalTerminal from "../code/LocalTerminal";
import MonacoDiffView from "./MonacoDiffView";
import OutputPanel from "./OutputPanel";
import PortsPanel from "./PortsPanel";
import ProblemsPanel from "./ProblemsPanel";

const TABS = [
  { id: "problems", label: "Problems" },
  { id: "output", label: "Output" },
  { id: "debug", label: "Debug Console" },
  { id: "terminal", label: "Terminal" },
  { id: "ports", label: "Ports" },
  { id: "diff", label: "Git diff" },
];

export default function BottomPanel({
  activeTab,
  onTabChange,
  visible,
  problems,
  outputLines,
  onClearOutput,
  debugLines,
  onDebugInput,
  terminalRef,
  sessionId,
  token,
  projectPath,
  terminalDisabled,
  gitDiff,
  activePath,
  fileContent,
  publicHost,
  problemCount,
  onOpenAt,
  localTerminal = false,
  localFiles = {},
  onRunFile,
  onAppendOutput,
}) {
  if (!visible) {
    return null;
  }

  return (
    <div className="ide-bottom-panel ide-bottom-panel-full">
      <div className="ide-panel-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "ide-panel-tab-active" : ""}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {tab.id === "problems" && problemCount > 0 ? ` (${problemCount})` : ""}
          </button>
        ))}
      </div>
      <div className="ide-bottom-panel-body">
        {activeTab === "problems" ? (
          <ProblemsPanel problems={problems} onOpenAt={onOpenAt} />
        ) : null}
        {activeTab === "output" ? <OutputPanel lines={outputLines} onClear={onClearOutput} /> : null}
        {activeTab === "debug" ? (
          <div className="ide-debug-panel">
            <pre className="ide-output-content">{debugLines.join("\n") || "Debug console ready."}</pre>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem("debug");
                if (input?.value) {
                  onDebugInput(input.value);
                  input.value = "";
                }
              }}
            >
              <input name="debug" placeholder="Evaluate expression (logged to output)…" />
            </form>
          </div>
        ) : null}
        {activeTab === "terminal" ? (
          localTerminal ? (
            <LocalTerminal
              ref={terminalRef}
              files={localFiles}
              onRunFile={onRunFile}
              onAppendOutput={onAppendOutput}
            />
          ) : (
            <IdeTerminal
              ref={terminalRef}
              sessionId={sessionId}
              token={token}
              projectPath={projectPath}
              disabled={terminalDisabled}
            />
          )
        ) : null}
        {activeTab === "ports" ? <PortsPanel publicHost={publicHost} /> : null}
        {activeTab === "diff" ? (
          gitDiff ? (
            <MonacoDiffView original={fileContent} modified={applyUnifiedDiff(fileContent, gitDiff)} path={activePath} />
          ) : (
            <p className="small muted">Open a changed file to view git diff.</p>
          )
        ) : null}
      </div>
    </div>
  );
}

function applyUnifiedDiff(original, diffText) {
  if (!diffText || !original) {
    return original || diffText;
  }
  const lines = original.split("\n");
  const out = [...lines];
  const diffLines = diffText.split("\n");
  for (const line of diffLines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      out.push(line.slice(1));
    }
  }
  return out.join("\n");
}
