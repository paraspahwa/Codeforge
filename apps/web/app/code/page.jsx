"use client";

import { ChatMessageList } from "@codeforge/ui";

import ProposalReview from "../../components/chat/ProposalReview";
import { useCodeWorkspace } from "../../lib/use-code-workspace";

export default function CodeWorkspacePage() {
  const ws = useCodeWorkspace();

  if (ws.ready && !ws.token) {
    return null;
  }

  return (
    <div className="code-workspace-page">
      <header className="code-workspace-header">
        <div>
          <h1>Code workspace</h1>
          <p className="small">Git, files, shell, and agent chat — desktop-style coding on the web.</p>
        </div>
        {ws.usage ? (
          <span className="usage-pill small">
            {ws.usage.requests_remaining ?? 0} requests left
          </span>
        ) : null}
      </header>

      <section className="panel code-toolbar">
        <label className="small" htmlFor="code-project-path">
          Project path
        </label>
        <div className="code-toolbar-row">
          <input
            id="code-project-path"
            value={ws.projectPath}
            onChange={(event) => ws.setProjectPath(event.target.value)}
            placeholder="C:/path/to/repo or /workspaces/my-app"
            disabled={ws.loading}
          />
          <button type="button" onClick={ws.handleCreateSession} disabled={ws.loading || !ws.projectPath.trim()}>
            New session
          </button>
          <button type="button" onClick={() => ws.refreshGit()} disabled={ws.loading || !ws.sessionId}>
            Refresh git
          </button>
        </div>
        <label className="small mt-6" htmlFor="code-session-select">
          Session
        </label>
        <select
          id="code-session-select"
          value={ws.sessionId}
          onChange={(event) => ws.handleSelectSession(event.target.value)}
          disabled={ws.loading || ws.sessions.length === 0}
        >
          <option value="">Select session</option>
          {ws.sessions.map((session) => (
            <option key={session.session_id} value={session.session_id}>
              {session.session_id} — {session.project_path}
            </option>
          ))}
        </select>
      </section>

      <div className="code-workspace-grid">
        <aside className="panel code-sidebar">
          <h3>Git</h3>
          {ws.gitStatus ? (
            <p className="small">
              <strong>{ws.gitStatus.branch}</strong> · {ws.gitStatus.clean ? "clean" : "dirty"}
            </p>
          ) : (
            <p className="small muted">Select a session to load git status.</p>
          )}
          <div className="code-file-list">
            {ws.changedFiles.length === 0 ? (
              <p className="small muted">No changed files.</p>
            ) : (
              ws.changedFiles.map((path) => (
                <button
                  key={path}
                  type="button"
                  className={`code-file-btn ${ws.selectedFile === path ? "code-file-btn-active" : ""}`}
                  onClick={() => ws.handlePreviewFile(path)}
                  disabled={ws.loading}
                >
                  {path}
                </button>
              ))
            )}
          </div>

          <h3 className="mt-8">Shell</h3>
          <input
            value={ws.shellCommand}
            onChange={(event) => ws.setShellCommand(event.target.value)}
            placeholder="pytest -q"
            disabled={ws.loading || !ws.sessionId}
          />
          <button
            type="button"
            className="mt-4"
            onClick={ws.handleRunShell}
            disabled={ws.loading || !ws.sessionId}
          >
            Run
          </button>
          {ws.shellOutput ? (
            <pre className="code-shell-output small">{ws.shellOutput}</pre>
          ) : null}

          <h3 className="mt-8">Verify loop</h3>
          <input
            value={ws.loopVerify}
            onChange={(event) => ws.setLoopVerify(event.target.value)}
            disabled={ws.loading || !ws.sessionId}
          />
          <button
            type="button"
            className="mt-4"
            onClick={ws.handleRunLoop}
            disabled={ws.loopRunning || !ws.sessionId}
          >
            {ws.loopRunning ? "Running…" : "Run loop"}
          </button>
        </aside>

        <section className="panel code-main">
          <h3>Chat</h3>
          <ChatMessageList messages={ws.messages} />
          {ws.pendingProposal ? (
            <ProposalReview
              pendingProposal={ws.pendingProposal}
              onDecision={ws.handleProposalDecision}
              loading={ws.loading}
            />
          ) : null}
          <form onSubmit={ws.handleSendPrompt} className="mt-6">
            <textarea
              rows={3}
              value={ws.prompt}
              onChange={(event) => ws.setPrompt(event.target.value)}
              placeholder="Refactor, explain, or /memory /taste /help…"
              disabled={!ws.sessionWritable || ws.loading}
            />
            <button type="submit" className="mt-4" disabled={!ws.canSend}>
              Send
            </button>
          </form>
        </section>

        <aside className="panel code-preview">
          <h3>Preview</h3>
          {ws.selectedFile ? <p className="small">{ws.selectedFile}</p> : <p className="small muted">Select a file</p>}
          {ws.gitDiff ? (
            <>
              <h4 className="small mt-6">Diff</h4>
              <pre className="code-diff small">{ws.gitDiff}</pre>
            </>
          ) : null}
          {ws.filePreview ? (
            <>
              <h4 className="small mt-6">Content</h4>
              <pre className="code-preview-body small">{ws.filePreview}</pre>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
