"use client";

import { formatSessionListLabel, viewOnlySessionMessage } from "@codeforge/shared/sessions";

import CodebaseSearchPanel from "../code/CodebaseSearchPanel";
import WorkspaceFileTree from "../code/WorkspaceFileTree";
import ExtensionsSidebar from "./ExtensionsSidebar";
import IdeSettingsSidebar from "./IdeSettingsSidebar";
import OutlinePanel from "./OutlinePanel";
import RunPanel from "./RunPanel";
import ScmPanel from "./ScmPanel";
import TimelinePanel from "./TimelinePanel";
import WorkspaceSearchPanel from "./WorkspaceSearchPanel";

export default function SidebarRouter({ view, ws }) {
  if (view === "explorer") {
    return (
      <div className="ide-sidebar-content">
        {!ws.localMode ? (
          <div className="ide-session-toolbar">
            <input
              value={ws.projectPath}
              onChange={(event) => ws.setProjectPath(event.target.value)}
              placeholder="Project path"
              disabled={ws.loading}
              aria-label="Project path"
            />
            <button type="button" onClick={ws.handleCreateSession} disabled={ws.loading || !ws.projectPath.trim()}>
              New
            </button>
            <select
              value={ws.sessionId}
              onChange={(event) => ws.handleSelectSession(event.target.value)}
              disabled={ws.loading || ws.sessions.length === 0}
              aria-label="Session"
            >
              <option value="">Session</option>
              {ws.sessions.map((session) => (
                <option key={session.session_id} value={session.session_id}>
                  {formatSessionListLabel(session)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="small muted ide-local-badge">Local workspace — saved in browser</p>
        )}
        {ws.currentSession && !ws.sessionWritable ? (
          <p className="small muted">{viewOnlySessionMessage(ws.currentSession)}</p>
        ) : null}
        <h3>Explorer</h3>
        {!ws.localMode && !ws.sessionId ? (
          <p className="small muted">Select a session to browse files.</p>
        ) : (
          <WorkspaceFileTree
            files={ws.workspaceFiles}
            changedFiles={ws.changedFiles}
            selectedFile={ws.selectedFile}
            onSelectFile={ws.openFile}
            onCreateFile={ws.handleCreateFile}
            onDeleteFile={ws.handleDeleteFile}
            onRenameFile={ws.handleRenameFile}
            loading={ws.loading}
            showChangedOnly={ws.showChangedOnly}
            onToggleChangedOnly={() => ws.setShowChangedOnly((value) => !value)}
          />
        )}
        {!ws.localMode ? (
          <>
            <OutlinePanel
              activePath={ws.activePath}
              onSearchSymbols={ws.handleSearchSymbols}
              onOpenAt={ws.openFileAt}
            />
            <TimelinePanel
              sessionId={ws.sessionId}
              activePath={ws.activePath}
              onLoadGitLog={ws.handleLoadGitLog}
              onOpenAt={ws.openFileAt}
            />
          </>
        ) : null}
      </div>
    );
  }

  if (view === "search") {
    return (
      <div className="ide-sidebar-content">
        <WorkspaceSearchPanel
          sessionId={ws.sessionId}
          loading={ws.loading}
          onSearch={ws.handleWorkspaceSearch}
          onOpenFile={ws.openFile}
          onOpenAt={ws.openFileAt}
        />
        <CodebaseSearchPanel
          sessionId={ws.sessionId}
          loading={ws.loading}
          onSearchSymbols={ws.handleSearchSymbols}
          onSearchKnowledge={ws.handleSearchKnowledge}
          onOpenFile={ws.openFileAt}
          onInsertMention={ws.handleInsertMention}
        />
      </div>
    );
  }

  if (view === "scm") {
    return (
      <ScmPanel
        gitStatus={ws.gitStatus}
        changedFiles={ws.changedFiles}
        onOpenFile={ws.openFile}
        onStage={ws.handleStageAndCommit}
        onRefresh={ws.refreshGit}
        loading={ws.loading}
      />
    );
  }

  if (view === "run") {
    return (
      <RunPanel
        loopVerify={ws.loopVerify}
        onLoopVerifyChange={ws.setLoopVerify}
        onRunLoop={ws.handleRunLoop}
        loopRunning={ws.loopRunning}
        onRunShell={ws.handleRunShell}
        shellCommand={ws.shellCommand}
        onShellCommandChange={ws.setShellCommand}
        launchConfigs={ws.launchConfigs}
        onRunLaunch={ws.handleRunLaunch}
        localMode={ws.localMode}
        onRunFile={ws.handleRunCode}
      />
    );
  }

  if (view === "extensions") {
    return <ExtensionsSidebar onOpenExtensionsPage={() => window.open("/extensions", "_blank")} />;
  }

  if (view === "settings") {
    return <IdeSettingsSidebar ws={ws} />;
  }

  return null;
}
