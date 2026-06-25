"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button, Icon } from "@codeforge/ui";

import ConflictAssistant from "./ConflictAssistant";
import WorkflowDrawer from "./WorkflowDrawer";

const TOOLS_EXPANDED_KEY = "codeforge_agent_tools_expanded";

const TOOL_TABS = [
  { id: "code", label: "Code", icon: "FileCode" },
  { id: "git", label: "Git", icon: "GitBranch" },
  { id: "terminal", label: "Terminal", icon: "Terminal" },
  { id: "search", label: "Search", icon: "Search" },
  { id: "workflows", label: "Workflows", icon: "Zap" },
];

function readToolsExpanded() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(TOOLS_EXPANDED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function AgentToolsPanel({
  sessionId,
  loading,
  sessionWritable,
  activeFile,
  onActiveFileChange,
  gitSummary,
  onRefreshGit,
  shellCommand,
  onShellCommandChange,
  onRunShell,
  shellOutput,
  shellRunning,
  symbolQuery,
  onSymbolQueryChange,
  onSearchSymbols,
  symbolResults,
  webQuery,
  onWebQueryChange,
  onWebSearch,
  webResults,
  workspaceFiles,
  onRefreshFiles,
  showConflictTool,
  onToggleConflictTool,
  conflictTargetBranch,
  onConflictTargetBranchChange,
  conflictGuide,
  conflictStrategy,
  onConflictStrategyChange,
  conflictPaths,
  onConflictPathsChange,
  onLoadConflictGuide,
  onApplyConflict,
  showWorkflows,
  onToggleWorkflows,
  loopVerify,
  onLoopVerifyChange,
  loopPrompt,
  onLoopPromptChange,
  loopMaxAttempts,
  onLoopMaxAttemptsChange,
  loopRunning,
  onRunLoop,
  planTargets,
  onPlanTargetsChange,
  autoMode,
  onAutoModeChange,
  onCompact,
  onUltrareview,
  onFork,
  onCreatePlan,
  onExecutePlan,
  onRollbackPlan,
  activePlanId,
  workflowOutput,
  templateName,
  onTemplateNameChange,
  templatePrefix,
  onTemplatePrefixChange,
  onCreateTemplate,
  templates,
  onRunTemplate,
  selectedTemplateId,
  onStageAll,
  onGitStatus,
  onGitDiff,
  onGitCommit,
  commitMessage,
  onCommitMessageChange,
  planMode,
  onPlanModeChange,
  permissionMode,
  onPermissionModeChange,
  onExecuteAgentPlan,
  onGitPush,
  onCreatePr,
  prTitle,
  onPrTitleChange,
  pushBranch,
  onPushBranchChange,
  checkpoints,
  onRefreshCheckpoints,
  onRewindCheckpoint,
  embedded = false,
}) {
  const [tab, setTab] = useState("code");
  const [expanded, setExpanded] = useState(embedded);

  useEffect(() => {
    if (embedded) {
      setExpanded(true);
      return;
    }
    setExpanded(readToolsExpanded());
  }, [embedded]);

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(TOOLS_EXPANDED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <section
      className={`agent-tools-panel ${embedded ? "agent-tools-panel-embedded" : ""} ${expanded ? "agent-tools-panel-expanded" : "agent-tools-panel-collapsed"}`}
    >
      {!embedded ? (
      <div className="agent-tools-collapsed-bar">
        <button
          type="button"
          className="agent-tools-toggle"
          onClick={toggleExpanded}
          aria-expanded={expanded}
        >
          <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={16} />
          Tools
        </button>
        <label className="agent-toggle-row small agent-tools-inline-control">
          <input
            type="checkbox"
            checked={planMode}
            onChange={(event) => onPlanModeChange(event.target.checked)}
            disabled={loading}
          />
          Plan
        </label>
        {planMode ? (
          <Button type="button" variant="ghost" onClick={onExecuteAgentPlan} disabled={loading || !sessionId}>
            Execute plan
          </Button>
        ) : null}
        <select
          id="permissionMode"
          className="agent-input agent-tools-permission-select"
          value={permissionMode}
          onChange={(event) => onPermissionModeChange(event.target.value)}
          disabled={loading}
          aria-label="Permission mode"
        >
          <option value="ask">Ask before risky actions</option>
          <option value="auto_safe">Auto-safe (sandbox)</option>
          <option value="auto_all">Auto-all (expanded)</option>
        </select>
        <Link href="/code" className="agent-feature-link-inline agent-tools-editor-link">
          Open editor →
        </Link>
      </div>
      ) : (
        <div className="agent-tools-embedded-bar">
          <label className="agent-toggle-row small agent-tools-inline-control">
            <input
              type="checkbox"
              checked={planMode}
              onChange={(event) => onPlanModeChange(event.target.checked)}
              disabled={loading}
            />
            Plan
          </label>
          {planMode ? (
            <Button type="button" variant="ghost" onClick={onExecuteAgentPlan} disabled={loading || !sessionId}>
              Execute plan
            </Button>
          ) : null}
          <select
            id="permissionModeEmbedded"
            className="agent-input agent-tools-permission-select"
            value={permissionMode}
            onChange={(event) => onPermissionModeChange(event.target.value)}
            disabled={loading}
            aria-label="Permission mode"
          >
            <option value="ask">Ask before risky actions</option>
            <option value="auto_safe">Auto-safe (sandbox)</option>
            <option value="auto_all">Auto-all (expanded)</option>
          </select>
          <Link href="/code" className="agent-feature-link-inline agent-tools-editor-link">
            Open editor →
          </Link>
        </div>
      )}

      {expanded ? (
        <>
          <div className="agent-tools-tabs" role="tablist">
            {TOOL_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`agent-tools-tab ${tab === item.id ? "agent-tools-tab-active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <Icon name={item.icon} size={14} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="agent-tools-body agent-tools-body-expanded">
            {tab === "code" ? (
              <div className="agent-tools-section">
                <label className="small" htmlFor="activeFile">
                  Active file (symbol-aware edits)
                </label>
                <input
                  id="activeFile"
                  className="agent-input"
                  value={activeFile}
                  onChange={(event) => onActiveFileChange(event.target.value)}
                  placeholder="src/main.py"
                  disabled={loading}
                  list="workspace-files-list"
                />
                <datalist id="workspace-files-list">
                  {(workspaceFiles || []).slice(0, 80).map((file) => (
                    <option key={file} value={file} />
                  ))}
                </datalist>
                <div className="agent-tools-row">
                  <Button type="button" variant="ghost" onClick={onRefreshFiles} disabled={!sessionId || loading}>
                    Refresh files
                  </Button>
                </div>
                <label className="small" htmlFor="symbolQuery">
                  Find symbol
                </label>
                <div className="agent-tools-inline">
                  <input
                    id="symbolQuery"
                    className="agent-input"
                    value={symbolQuery}
                    onChange={(event) => onSymbolQueryChange(event.target.value)}
                    placeholder="login, AuthService, main…"
                    disabled={loading || !sessionId}
                  />
                  <Button type="button" onClick={onSearchSymbols} disabled={!sessionId || loading || !symbolQuery.trim()}>
                    Go
                  </Button>
                </div>
                {symbolResults?.length ? (
                  <ul className="agent-symbol-list small">
                    {symbolResults.slice(0, 12).map((item) => (
                      <li key={`${item.file}:${item.line}:${item.symbol}`}>
                        <button
                          type="button"
                          className="agent-symbol-hit"
                          onClick={() => onActiveFileChange(item.file)}
                        >
                          <code>{item.symbol}</code>
                          <span>
                            {item.kind} · {item.file}:{item.line}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {tab === "git" ? (
              <div className="agent-tools-section">
                {gitSummary ? <p className="agent-git-summary small">{gitSummary}</p> : null}
                <div className="agent-tools-row">
                  <Button type="button" variant="ghost" onClick={onGitStatus} disabled={!sessionId || loading}>
                    Status
                  </Button>
                  <Button type="button" variant="ghost" onClick={onGitDiff} disabled={!sessionId || loading}>
                    Diff
                  </Button>
                  <Button type="button" variant="ghost" onClick={onRefreshGit} disabled={!sessionId || loading}>
                    Refresh
                  </Button>
                  <Button type="button" variant="ghost" onClick={onStageAll} disabled={!sessionId || loading || !sessionWritable}>
                    Stage all
                  </Button>
                </div>
                <label className="small" htmlFor="commitMessage">
                  Commit message
                </label>
                <input
                  id="commitMessage"
                  className="agent-input"
                  value={commitMessage}
                  onChange={(event) => onCommitMessageChange(event.target.value)}
                  placeholder="feat: add auth API"
                  disabled={loading || !sessionWritable}
                />
                <Button type="button" onClick={onGitCommit} disabled={!sessionId || loading || !commitMessage.trim() || !sessionWritable}>
                  Commit
                </Button>
                <label className="small" htmlFor="pushBranch">
                  Push branch (optional)
                </label>
                <input
                  id="pushBranch"
                  className="agent-input"
                  value={pushBranch}
                  onChange={(event) => onPushBranchChange(event.target.value)}
                  placeholder="feature/my-branch"
                  disabled={loading || !sessionWritable}
                />
                <div className="agent-tools-row">
                  <Button type="button" variant="ghost" onClick={onGitPush} disabled={!sessionId || loading || !sessionWritable}>
                    Push
                  </Button>
                </div>
                <label className="small" htmlFor="prTitle">
                  Pull request title
                </label>
                <input
                  id="prTitle"
                  className="agent-input"
                  value={prTitle}
                  onChange={(event) => onPrTitleChange(event.target.value)}
                  placeholder="feat: add auth API"
                  disabled={loading || !sessionWritable}
                />
                <Button type="button" onClick={onCreatePr} disabled={!sessionId || loading || !sessionWritable}>
                  Create PR
                </Button>
                <ConflictAssistant
                  show={showConflictTool}
                  onToggle={onToggleConflictTool}
                  conflictTargetBranch={conflictTargetBranch}
                  onConflictTargetBranchChange={onConflictTargetBranchChange}
                  conflictGuide={conflictGuide}
                  conflictStrategy={conflictStrategy}
                  onConflictStrategyChange={onConflictStrategyChange}
                  conflictPaths={conflictPaths}
                  onConflictPathsChange={onConflictPathsChange}
                  sessionId={sessionId}
                  loading={loading}
                  sessionWritable={sessionWritable}
                  onLoadGuide={onLoadConflictGuide}
                  onApply={onApplyConflict}
                />
              </div>
            ) : null}

            {tab === "terminal" ? (
              <div className="agent-tools-section">
                <label className="small" htmlFor="shellCommand">
                  Run command (sandboxed: pytest, npm test, rg, git status…)
                </label>
                <div className="agent-tools-inline">
                  <input
                    id="shellCommand"
                    className="agent-input agent-input-mono"
                    value={shellCommand}
                    onChange={(event) => onShellCommandChange(event.target.value)}
                    placeholder="pytest -q"
                    disabled={loading || shellRunning || !sessionId}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onRunShell();
                      }
                    }}
                  />
                  <Button type="button" onClick={onRunShell} disabled={!sessionId || loading || shellRunning || !shellCommand.trim()}>
                    {shellRunning ? "Running…" : "Run"}
                  </Button>
                </div>
                {shellOutput ? <pre className="agent-shell-output">{shellOutput}</pre> : null}
              </div>
            ) : null}

            {tab === "search" ? (
              <div className="agent-tools-section">
                <label className="small" htmlFor="webQuery">
                  Web search (docs, errors, dependencies)
                </label>
                <div className="agent-tools-inline">
                  <input
                    id="webQuery"
                    className="agent-input"
                    value={webQuery}
                    onChange={(event) => onWebQueryChange(event.target.value)}
                    placeholder="FastAPI JWT auth example"
                    disabled={loading || !sessionId}
                  />
                  <Button type="button" onClick={onWebSearch} disabled={!sessionId || loading || !webQuery.trim()}>
                    Search
                  </Button>
                </div>
                {webResults?.length ? (
                  <ul className="agent-search-results small">
                    {webResults.map((item) => (
                      <li key={item.url}>
                        <a href={item.url} target="_blank" rel="noreferrer">
                          {item.title}
                        </a>
                        {item.snippet ? <p>{item.snippet}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {tab === "workflows" ? (
              <div className="agent-tools-section">
                <div className="agent-tools-row">
                  <Button type="button" variant="ghost" onClick={onRefreshCheckpoints} disabled={!sessionId || loading}>
                    Refresh checkpoints
                  </Button>
                </div>
                {checkpoints?.length ? (
                  <ul className="agent-checkpoint-list small">
                    {checkpoints.slice(0, 8).map((item) => (
                      <li key={item.checkpoint_id}>
                        <span>{item.label || item.checkpoint_id}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onRewindCheckpoint(item.checkpoint_id)}
                          disabled={loading || !sessionWritable}
                        >
                          Rewind
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="small">Checkpoints appear before file writes.</p>
                )}
                <WorkflowDrawer
                  showWorkflows={showWorkflows}
                  onToggle={onToggleWorkflows}
                  sessionId={sessionId}
                  loading={loading}
                  sessionWritable={sessionWritable}
                  loopVerify={loopVerify}
                  onLoopVerifyChange={onLoopVerifyChange}
                  loopPrompt={loopPrompt}
                  onLoopPromptChange={onLoopPromptChange}
                  loopMaxAttempts={loopMaxAttempts}
                  onLoopMaxAttemptsChange={onLoopMaxAttemptsChange}
                  loopRunning={loopRunning}
                  onRunLoop={onRunLoop}
                  planTargets={planTargets}
                  onPlanTargetsChange={onPlanTargetsChange}
                  autoMode={autoMode}
                  onAutoModeChange={onAutoModeChange}
                  onCompact={onCompact}
                  onUltrareview={onUltrareview}
                  onFork={onFork}
                  onCreatePlan={onCreatePlan}
                  onExecutePlan={onExecutePlan}
                  onRollbackPlan={onRollbackPlan}
                  activePlanId={activePlanId}
                  workflowOutput={workflowOutput}
                  templateName={templateName}
                  onTemplateNameChange={onTemplateNameChange}
                  templatePrefix={templatePrefix}
                  onTemplatePrefixChange={onTemplatePrefixChange}
                  onCreateTemplate={onCreateTemplate}
                  templates={templates}
                  onRunTemplate={onRunTemplate}
                  selectedTemplateId={selectedTemplateId}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
