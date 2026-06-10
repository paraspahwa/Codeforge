import { formatRoutingSignal } from "@codeforge/shared/sse";
import { formatSessionListLabel, viewOnlySessionMessage } from "@codeforge/shared/sessions";
import { ChatMessageList } from "@codeforge/ui";

import { useCodeWorkspace } from "./use-code-workspace";

export default function CodeWorkspace() {
  const ws = useCodeWorkspace();

  return (
    <div className="code-workspace">
      <header className="workspace-header">
        <div>
          <h1>Code Mode</h1>
          <p className="muted">Chat, diff review, git, shell, and verify/fix loops on the shared backend.</p>
        </div>
        <div className="header-meta">
          {ws.usage ? (
            <span className="usage-pill">
              {ws.usage.requests_used_in_period ?? ws.usage.total_requests}/{ws.usage.request_limit} this month
              {" · "}
              {ws.usage.requests_remaining} left
            </span>
          ) : null}
          <span className="muted">model: {ws.lastModel}</span>
        </div>
      </header>

      {ws.routingSignal ? (
        <div className={`routing-signal ${ws.routingSignal.review_required ? "routing-signal-review" : ""}`}>
          <span>{formatRoutingSignal(ws.routingSignal)}</span>
          {ws.routingSignal.review_required ? (
            <strong>Human review recommended before applying changes.</strong>
          ) : null}
        </div>
      ) : null}

      {ws.statusMessage ? <div className="status success">{ws.statusMessage}</div> : null}
      {ws.errorMessage ? <div className="status error">{ws.errorMessage}</div> : null}

      <section className="workspace-toolbar card">
        <div className="toolbar-group toolbar-grow">
          <label htmlFor="code-path">Project</label>
          <input
            id="code-path"
            value={ws.projectPath}
            onChange={(event) => ws.setProjectPath(event.target.value)}
            disabled={ws.loading}
            placeholder="c:/path/to/project"
          />
          <button type="button" onClick={ws.handlePickPath} disabled={ws.loading}>
            Pick Folder
          </button>
          <button
            type="button"
            onClick={ws.handleCreateSession}
            disabled={!ws.token || !ws.projectPath.trim() || ws.loading}
          >
            New Session
          </button>
        </div>
      </section>

      <div className="workspace-grid">
        <aside className="workspace-sidebar card">
          <h2>Sessions</h2>
          <select
            value={ws.sessionId}
            onChange={(event) => ws.handleSelectSession(event.target.value)}
            disabled={ws.loading || ws.sessions.length === 0}
          >
            <option value="">Select session</option>
            {ws.sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {formatSessionListLabel(session)}
              </option>
            ))}
          </select>
          {ws.currentSession ? <p className="muted small">{ws.currentSession.project_path}</p> : null}
          {!ws.sessionWritable && ws.currentSession ? (
            <p className="muted small">{viewOnlySessionMessage(ws.currentSession)}</p>
          ) : null}

          <h3>Git</h3>
          {ws.gitStatus ? (
            <>
              <p className="small">
                <strong>{ws.gitStatus.branch}</strong> · {ws.gitStatus.clean ? "clean" : "dirty"}
              </p>
              <p className="muted small">{ws.gitStatus.summary}</p>
              <div className="file-list">
                {ws.changedFiles.length === 0 ? <p className="muted small">No changed files.</p> : null}
                {ws.changedFiles.map((path) => (
                  <button
                    key={path}
                    type="button"
                    className={`file-btn ${ws.selectedFile === path ? "file-btn-active" : ""}`}
                    onClick={() => ws.handlePreviewFile(path)}
                    disabled={ws.loading}
                  >
                    {path}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="muted small">Select a session to load git status.</p>
          )}

          <h3>File Preview</h3>
          <input
            value={ws.selectedFile}
            onChange={(event) => ws.setSelectedFile(event.target.value)}
            placeholder="relative/path.py"
            disabled={ws.loading}
          />
          <button
            type="button"
            onClick={() => ws.handlePreviewFile(ws.selectedFile)}
            disabled={!ws.selectedFile || ws.loading}
          >
            Load Preview
          </button>
        </aside>

        <section className="workspace-chat card">
          <h2>Chat</h2>
          <ChatMessageList
            variant="desktop"
            messages={ws.messages}
            chatEndRef={ws.chatEndRef}
            streamingMessageId={ws.streamingMessageId}
            sessionId={ws.sessionId}
            loading={ws.loading}
          />
          <form className="chat-form" onSubmit={ws.handleSend}>
            <textarea
              rows={3}
              value={ws.prompt}
              onChange={(event) => ws.setPrompt(event.target.value)}
              placeholder="Ask CodeForge to edit, explain, or review your project…"
              disabled={!ws.token || !ws.sessionId || ws.loading || !ws.sessionWritable}
            />
            <button type="submit" disabled={!ws.canSend}>
              {ws.loading ? "Working…" : "Send"}
            </button>
          </form>
        </section>

        <aside className="workspace-review card">
          <h2>Review</h2>
          {ws.pendingProposal ? (
            <div className="preview-box">
              <p>
                <strong>{ws.pendingProposal.target_file}</strong>
              </p>
              <p className="muted small">status: {ws.pendingProposal.status || "pending"}</p>
              <pre className="diff-preview">{ws.pendingProposal.patch_preview || "(no diff preview)"}</pre>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => ws.handleProposalDecision("approve")}
                  disabled={ws.loading || ws.pendingProposal.status === "approved" || !ws.sessionWritable}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => ws.handleProposalDecision("reject")}
                  disabled={ws.loading || ws.pendingProposal.status === "rejected"}
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <p className="muted small">Proposals appear here after agent runs.</p>
          )}

          {ws.filePreview ? (
            <div className="preview-box">
              <p className="small">
                <strong>Preview:</strong> {ws.selectedFile}
              </p>
              <pre className="diff-preview">{ws.filePreview}</pre>
            </div>
          ) : null}

          {ws.gitDiff ? (
            <div className="preview-box">
              <p className="small">
                <strong>Git diff:</strong> {ws.selectedFile}
              </p>
              <pre className="diff-preview">{ws.gitDiff}</pre>
            </div>
          ) : null}

          <h3>Activity</h3>
          <ul className="activity-list">
            {ws.activity.length === 0 ? <li className="muted">No events yet.</li> : null}
            {ws.activity.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="workspace-tools card workspace-tools-wide">
        <div className="tool-panel">
          <h3>Workflows</h3>
          <div className="button-row">
            <button
              type="button"
              onClick={ws.handleCompact}
              disabled={!ws.token || !ws.sessionId || ws.loading || !ws.sessionWritable}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={ws.handleUltrareview}
              disabled={!ws.token || !ws.sessionId || ws.loading || !ws.sessionWritable}
            >
              Ultrareview
            </button>
            <button
              type="button"
              onClick={ws.handleForkSession}
              disabled={!ws.token || !ws.sessionId || ws.loading || !ws.sessionWritable}
            >
              Fork
            </button>
          </div>
          <input
            value={ws.planTargets}
            onChange={(event) => ws.setPlanTargets(event.target.value)}
            placeholder="plan targets: file1.py file2.py"
            disabled={ws.loading}
          />
          <label className="small">
            <input
              type="checkbox"
              checked={ws.autoMode}
              onChange={(event) => ws.setAutoMode(event.target.checked)}
              disabled={ws.loading}
            />{" "}
            Auto mode
          </label>
          <div className="button-row">
            <button
              type="button"
              onClick={ws.handleCreatePlan}
              disabled={!ws.token || !ws.sessionId || ws.loading || !ws.sessionWritable}
            >
              Plan
            </button>
            <button
              type="button"
              onClick={ws.handleExecutePlan}
              disabled={!ws.activePlanId || ws.loading || !ws.sessionWritable}
            >
              Run Plan
            </button>
            <button
              type="button"
              onClick={ws.handleRollbackPlan}
              disabled={!ws.activePlanId || ws.loading || !ws.sessionWritable}
            >
              Rollback
            </button>
          </div>
          {ws.workflowOutput ? <pre className="shell-output">{ws.workflowOutput}</pre> : null}
          <h4 className="small">Agent templates</h4>
          <select
            value={ws.selectedTemplateId}
            onChange={(event) => ws.setSelectedTemplateId(event.target.value)}
            disabled={ws.loading}
          >
            <option value="">None</option>
            {ws.templates.map((template) => (
              <option key={template.template_id} value={template.template_id}>
                {template.name}
              </option>
            ))}
          </select>
          <input
            value={ws.templateName}
            onChange={(event) => ws.setTemplateName(event.target.value)}
            placeholder="template name"
            disabled={ws.loading}
          />
          <textarea
            rows={3}
            value={ws.templatePrefix}
            onChange={(event) => ws.setTemplatePrefix(event.target.value)}
            placeholder="prompt prefix"
            disabled={ws.loading}
          />
          <button type="button" onClick={ws.handleCreateTemplate} disabled={!ws.token || ws.loading}>
            Save template
          </button>
          <h4 className="small">Artifacts</h4>
          {ws.artifacts.length === 0 ? (
            <p className="muted small">No artifacts yet.</p>
          ) : (
            <div className="button-row">
              {ws.artifacts.map((artifact) => (
                <button
                  key={artifact.artifact_id}
                  type="button"
                  onClick={() => ws.handlePreviewArtifact(artifact.artifact_id)}
                  disabled={ws.loading}
                >
                  {artifact.title}
                </button>
              ))}
            </div>
          )}
          {ws.artifactPreviewHtml ? (
            <iframe
              title="Artifact preview"
              className="artifact-preview-frame"
              sandbox="allow-scripts"
              srcDoc={ws.artifactPreviewHtml}
            />
          ) : null}
        </div>
        <div className="tool-panel">
          <h3>Shell</h3>
          <div className="button-row">
            <input
              value={ws.shellCommand}
              onChange={(event) => ws.setShellCommand(event.target.value)}
              disabled={ws.loading}
            />
            <button type="button" onClick={ws.handleRunShell} disabled={!ws.token || !ws.sessionId || ws.loading}>
              Run
            </button>
          </div>
          {ws.shellOutput ? <pre className="shell-output">{ws.shellOutput}</pre> : null}
        </div>
        <div className="tool-panel">
          <h3>Verify / Fix Loop</h3>
          <div className="button-row">
            <input
              value={ws.loopVerify}
              onChange={(event) => ws.setLoopVerify(event.target.value)}
              disabled={ws.loopRunning || ws.loading}
              placeholder="pytest -q"
            />
            <button
              type="button"
              onClick={ws.handleRunLoop}
              disabled={!ws.token || !ws.sessionId || ws.loopRunning || ws.loading || !ws.sessionWritable}
            >
              {ws.loopRunning ? "Loop running…" : "Run Loop"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
