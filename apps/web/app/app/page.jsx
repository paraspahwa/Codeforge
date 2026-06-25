"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChatMessageList } from "@codeforge/ui";

import AgentActivityFeed from "../../components/chat/AgentActivityFeed";
import AgentToolsPanel from "../../components/chat/AgentToolsPanel";
import AgentWelcome from "../../components/chat/AgentWelcome";
import ChatContextPanel from "../../components/chat/ChatContextPanel";
import ChatLayout from "../../components/chat/ChatLayout";
import Composer from "../../components/chat/Composer";
import MagicPointerChips from "../../components/ide/MagicPointerChips";
import DeployChecklistPanel from "../../components/chat/DeployChecklistPanel";
import FounderPreviewPanel from "../../components/chat/FounderPreviewPanel";
import ParallelSessionsBar from "../../components/chat/ParallelSessionsBar";
import SessionSidebar from "../../components/chat/SessionSidebar";
import { SessionProvider } from "../../lib/session-context";
import { useChatPage } from "../../lib/use-chat-page";

function buildAgentToolsProps(chat) {
  return {
    sessionId: chat.sessionId,
    loading: chat.loading,
    sessionWritable: chat.sessionWritable,
    activeFile: chat.activeFile,
    onActiveFileChange: chat.setActiveFile,
    gitSummary: chat.gitSummary,
    onRefreshGit: chat.handleRefreshGit,
    shellCommand: chat.shellCommand,
    onShellCommandChange: chat.setShellCommand,
    onRunShell: chat.handleRunShell,
    shellOutput: chat.shellOutput,
    shellRunning: chat.shellRunning,
    symbolQuery: chat.symbolQuery,
    onSymbolQueryChange: chat.setSymbolQuery,
    onSearchSymbols: chat.handleSearchSymbols,
    symbolResults: chat.symbolResults,
    webQuery: chat.webQuery,
    onWebQueryChange: chat.setWebQuery,
    onWebSearch: chat.handleWebSearch,
    webResults: chat.webResults,
    workspaceFiles: chat.workspaceFiles,
    onRefreshFiles: chat.handleRefreshFiles,
    showConflictTool: chat.showConflictTool,
    onToggleConflictTool: () => chat.setShowConflictTool((open) => !open),
    conflictTargetBranch: chat.conflictTargetBranch,
    onConflictTargetBranchChange: chat.setConflictTargetBranch,
    conflictGuide: chat.conflictGuide,
    conflictStrategy: chat.conflictStrategy,
    onConflictStrategyChange: chat.setConflictStrategy,
    conflictPaths: chat.conflictPaths,
    onConflictPathsChange: chat.setConflictPaths,
    onLoadConflictGuide: chat.handleLoadConflictGuide,
    onApplyConflict: chat.handleApplyConflictAssist,
    showWorkflows: chat.showWorkflows,
    onToggleWorkflows: () => chat.setShowWorkflows((open) => !open),
    loopVerify: chat.loopVerify,
    onLoopVerifyChange: chat.setLoopVerify,
    loopPrompt: chat.loopPrompt,
    onLoopPromptChange: chat.setLoopPrompt,
    loopMaxAttempts: chat.loopMaxAttempts,
    onLoopMaxAttemptsChange: chat.setLoopMaxAttempts,
    loopRunning: chat.loopRunning,
    onRunLoop: chat.handleRunLoop,
    planTargets: chat.planTargets,
    onPlanTargetsChange: chat.setPlanTargets,
    autoMode: chat.autoMode,
    onAutoModeChange: chat.setAutoMode,
    onCompact: chat.handleCompact,
    onUltrareview: chat.handleUltrareview,
    onFork: chat.handleForkSession,
    onCreatePlan: chat.handleCreatePlan,
    onExecutePlan: chat.handleExecutePlan,
    onRollbackPlan: chat.handleRollbackPlan,
    activePlanId: chat.activePlanId,
    workflowOutput: chat.workflowOutput,
    templateName: chat.templateName,
    onTemplateNameChange: chat.setTemplateName,
    templatePrefix: chat.templatePrefix,
    onTemplatePrefixChange: chat.setTemplatePrefix,
    onCreateTemplate: chat.handleCreateTemplate,
    templates: chat.templates,
    onRunTemplate: chat.handleRunTemplate,
    selectedTemplateId: chat.selectedTemplateId,
    onStageAll: chat.handleStageAll,
    onGitStatus: chat.handleGitStatus,
    onGitDiff: chat.handleGitDiff,
    onGitCommit: chat.handleGitCommit,
    commitMessage: chat.commitMessage,
    onCommitMessageChange: chat.setCommitMessage,
    planMode: chat.planMode,
    onPlanModeChange: chat.setPlanMode,
    permissionMode: chat.permissionMode,
    onPermissionModeChange: chat.setPermissionMode,
    onExecuteAgentPlan: chat.handleExecuteAgentPlan,
    onGitPush: chat.handleGitPush,
    onCreatePr: chat.handleCreatePr,
    prTitle: chat.prTitle,
    onPrTitleChange: chat.setPrTitle,
    pushBranch: chat.pushBranch,
    onPushBranchChange: chat.setPushBranch,
    checkpoints: chat.checkpoints,
    onRefreshCheckpoints: chat.handleRefreshCheckpoints,
    onRewindCheckpoint: chat.handleRewindCheckpoint,
    embedded: true,
  };
}

export default function ChatPage() {
  const router = useRouter();
  const chat = useChatPage();
  const [contextOpen, setContextOpen] = useState(false);
  const [contextTab, setContextTab] = useState("tools");

  if (chat.ready && !chat.token) {
    return null;
  }

  function openContext(tab) {
    setContextTab(tab);
    setContextOpen(true);
  }

  const showPreview = Boolean(chat.showPostRunPanels && chat.artifacts?.length);
  const showDeploy = Boolean(chat.showPostRunPanels);
  const deployReady = chat.deployReadiness?.ready ?? false;
  const agentToolsProps = buildAgentToolsProps(chat);

  const sidebar = (
    <SessionSidebar
      projectPath={chat.projectPath}
      onProjectPathChange={chat.setProjectPath}
      onCreateSession={chat.handleCreateSession}
      sessionId={chat.sessionId}
      sessionHistory={chat.sessionHistory}
      onSelectSession={chat.handleSelectSession}
      loading={chat.loading}
      sessionFilter={chat.sessionFilter}
      onSessionFilterChange={chat.setSessionFilter}
      mascotState={chat.mascotState}
      agents={chat.agentCatalog}
      selectedAgent={chat.selectedAgent}
      onSelectAgent={chat.handleAgentChange}
    />
  );

  const contextPanel = (
    <ChatContextPanel
      activeTab={contextTab}
      onTabChange={setContextTab}
      showTools={Boolean(chat.sessionId)}
      showPreview={showPreview}
      showDeploy={showDeploy}
      tools={chat.sessionId ? <AgentToolsPanel {...agentToolsProps} /> : null}
      preview={
        <FounderPreviewPanel
          embedded
          visible
          artifacts={chat.artifacts}
          selectedArtifactId={chat.selectedArtifactId}
          artifactPreviewHtml={chat.artifactPreviewHtml}
          loading={chat.previewLoading}
          onPreview={chat.handlePreviewArtifact}
          onDismiss={() => setContextOpen(false)}
        />
      }
      deploy={
        <DeployChecklistPanel
          embedded
          visible
          deployReadiness={chat.deployReadiness}
          sessionChecks={chat.sessionDeployChecks}
          loading={chat.deployReadinessLoading}
          onDismiss={() => setContextOpen(false)}
        />
      }
    />
  );

  const chatPanel = (
    <section className="agent-chat agent-chat-immersive">
      <header className="agent-chat-bar">
        <div className="agent-chat-bar-lead">
          <span className="agent-chat-bar-title">
            {chat.sessionId ? "Chat" : "New conversation"}
          </span>
          <ParallelSessionsBar
            compact
            sessions={chat.parallelSessions}
            activeSessionId={chat.sessionId}
            onSelect={chat.handleSelectParallelSession}
            onFork={chat.handleForkSession}
            loading={chat.loading}
            disabled={!chat.sessionWritable}
          />
        </div>
        {chat.sessionId ? (
          <div className="agent-chat-bar-actions">
            {showPreview ? (
              <button
                type="button"
                className="cf-status-pill"
                onClick={() => openContext("preview")}
              >
                Preview
              </button>
            ) : null}
            {showDeploy ? (
              <button
                type="button"
                className={`cf-status-pill ${deployReady ? "cf-status-pill-ok" : "cf-status-pill-warn"}`}
                onClick={() => openContext("deploy")}
              >
                {deployReady ? "Deploy ready" : "Deploy checklist"}
              </button>
            ) : null}
            <button type="button" className="cf-status-pill" onClick={() => openContext("tools")}>
              Tools
            </button>
          </div>
        ) : null}
      </header>

      <div className="agent-chat-body">
        <div className="agent-chat-log">
          <div className="agent-chat-log-inner">
            {!chat.sessionId ? (
              <AgentWelcome
                loading={chat.loading}
                onStartSession={chat.handleCreateSession}
                onStartGoal={chat.handleStartWithGoal}
                onExploreFeatures={() => router.push("/features")}
              />
            ) : (
              <ChatMessageList
                variant="web"
                messages={chat.messages}
                chatEndRef={chat.chatEndRef}
                streamingMessageId={chat.streamingMessageId}
                sessionId={chat.sessionId}
                loading={chat.loading}
                thinkingEvents={chat.thinkingEvents}
              />
            )}
          </div>
        </div>

        {chat.pendingProposal && chat.sessionId ? (
          <div className="agent-inline-activity">
            <AgentActivityFeed agentEvents={chat.agentEvents} pendingProposal={chat.pendingProposal} />
          </div>
        ) : null}

        <MagicPointerChips
          entities={chat.pointerEntities}
          onAction={chat.handlePointerEntityAction}
          disabled={chat.loading}
        />
      </div>

      <footer className="agent-chat-footer">
        <Composer
          prompt={chat.prompt}
          onPromptChange={chat.setPrompt}
          onSubmit={chat.handleSendPrompt}
          canSend={chat.canSend}
          loading={chat.loading}
          sessionId={chat.sessionId}
          attachedFiles={chat.attachedFiles}
          onRemoveAttachment={chat.handleRemoveAttachment}
          onAttachWorkspaceFile={chat.handleAttachWorkspaceFile}
          onUploadAttachments={chat.handleUploadAttachments}
          workspaceFiles={chat.workspaceFiles}
        />
      </footer>
    </section>
  );

  return (
    <SessionProvider sessionId={chat.sessionId} sessions={chat.sessionHistory}>
      <ChatLayout
        sidebar={sidebar}
        chat={chatPanel}
        contextPanel={contextPanel}
        contextOpen={contextOpen}
        onCloseContext={() => setContextOpen(false)}
      />
    </SessionProvider>
  );
}
