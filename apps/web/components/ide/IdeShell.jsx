"use client";

import CommandPalette from "../code/CommandPalette";
import EditorStatusBar from "../code/EditorStatusBar";
import EditorTabBar from "../code/EditorTabBar";
import QuickOpenPalette from "../code/QuickOpenPalette";
import SplitEditorLayout from "../code/SplitEditorLayout";
import ActivityBar from "./ActivityBar";
import BottomPanel from "./BottomPanel";
import ComposerPanel from "./ComposerPanel";
import EditorBreadcrumbs from "./EditorBreadcrumbs";
import MenuBar from "./MenuBar";
import SidebarRouter from "./SidebarRouter";
import TitleBar from "./TitleBar";

export default function IdeShell({ ws }) {
  const workspaceName = ws.projectPath?.split("/").filter(Boolean).pop() || "Codeforge-1";
  const remoteLabel = ws.projectPath ? `Remote · ${ws.projectPath}` : null;
  const publicHost =
    typeof window !== "undefined"
      ? window.location.hostname
      : process.env.NEXT_PUBLIC_API_BASE?.replace(/^https?:\/\//, "").split(":")[0];

  return (
    <div
      className={`ide-shell ide-shell-immersive ${ws.zenMode ? "ide-shell-zen" : ""} ${ws.editorTheme === "light" ? "ide-shell-theme-light" : ""}`}
    >
      <TitleBar
        workspaceName={workspaceName}
        remoteLabel={remoteLabel}
        globalSearch={ws.globalSearch}
        onGlobalSearchChange={ws.setGlobalSearch}
        onOpenQuickOpen={() => ws.setQuickOpenOpen(true)}
        usage={ws.usage}
        onRun={ws.localMode ? ws.handleRunCode : undefined}
        sessionId={ws.sessionId}
      />
      <MenuBar onRunCommand={ws.executeIdeCommand} />

      <div className="ide-shell-body">
        <ActivityBar
          activeView={ws.activityView}
          onChange={(view) => {
            ws.setShowSidebar(true);
            ws.setActivityView(view);
          }}
          composerOpen={ws.showChatPanel}
          onToggleComposer={() => ws.executeIdeCommand("toggle-composer")}
        />

        <div
          className={`ide-workbench ${ws.showSidebar ? "" : "ide-workbench-sidebar-hidden"} ${
            ws.showChatPanel ? "" : "ide-workbench-composer-hidden"
          }`}
        >
          {ws.showSidebar ? (
            <aside className="ide-primary-sidebar">
              <SidebarRouter view={ws.activityView} ws={ws} />
            </aside>
          ) : null}

          <div className="ide-main-column">
            <section className="ide-center ide-center-full">
              <EditorTabBar
                tabs={ws.tabs}
                activePath={ws.activePath}
                onSelect={ws.selectTab}
                onClose={ws.closeTab}
                onCloseOthers={ws.closeOtherTabs}
                onCloseAll={ws.closeAllTabs}
                onSplitRight={ws.onSplitRight}
                onSplitDown={ws.onSplitDown}
                onCopyPath={ws.onCopyPath}
              />
              <EditorBreadcrumbs path={ws.activePath} heading={ws.breadcrumbHeading} />
              <SplitEditorLayout ws={ws} />
            </section>

            {ws.showBottomPanel ? (
              <div className="ide-bottom-wrap">
                <BottomPanel
                  activeTab={ws.bottomPanel}
                  onTabChange={ws.setBottomPanel}
                  visible={ws.showBottomPanel}
                  problems={ws.problems}
                  outputLines={ws.outputLines}
                  onClearOutput={ws.clearOutput}
                  debugLines={ws.debugLines}
                  onDebugInput={ws.handleDebugInput}
                  terminalRef={ws.terminalRef}
                  sessionId={ws.sessionId}
                  token={ws.token}
                  projectPath={ws.projectPath}
                  terminalDisabled={!ws.localMode && (!ws.sessionId || !ws.token)}
                  gitDiff={ws.gitDiff}
                  activePath={ws.activePath}
                  fileContent={ws.fileEditorContent}
                  publicHost={publicHost}
                  problemCount={ws.problems.length}
                  onOpenAt={ws.openFileAt}
                  localTerminal={ws.localTerminal}
                  localFiles={ws.localFiles}
                  onRunFile={ws.handleRunCode}
                  onAppendOutput={ws.appendOutput}
                />
              </div>
            ) : null}
          </div>

          {ws.showChatPanel ? (
            <ComposerPanel ws={ws} onClose={() => ws.setShowChatPanel(false)} />
          ) : null}
        </div>
      </div>

      <EditorStatusBar
        path={ws.activePath}
        cursor={ws.cursor}
        branch={ws.gitStatus?.branch}
        dirty={ws.fileDirty}
        panel={ws.showBottomPanel ? ws.bottomPanel : "hidden"}
        onTogglePanel={() => ws.setShowBottomPanel((value) => !value)}
        problemCount={ws.problems.length}
        remoteLabel={remoteLabel}
        indentSize={2}
        onOpenProblems={() => ws.executeIdeCommand("problems")}
      />

      <CommandPalette
        open={ws.commandPaletteOpen}
        commands={ws.ideCommands.map((cmd) => ({
          id: cmd.id,
          label: cmd.label,
          shortcut: cmd.shortcut,
          hint: cmd.hint,
        }))}
        onClose={() => ws.setCommandPaletteOpen(false)}
        onRun={(cmd) => ws.executeIdeCommand(cmd.id)}
      />

      <QuickOpenPalette
        open={ws.quickOpenOpen}
        files={ws.workspaceFiles}
        initialQuery={ws.globalSearch}
        onClose={() => ws.setQuickOpenOpen(false)}
        onOpen={ws.openFile}
      />
    </div>
  );
}
