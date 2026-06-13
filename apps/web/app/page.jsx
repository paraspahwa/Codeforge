"use client";

import { useRouter } from "next/navigation";

import { ChatMessageList } from "@codeforge/ui";

import AgentActivityFeed from "../components/chat/AgentActivityFeed";
import AgentToolsPanel from "../components/chat/AgentToolsPanel";
import AgentWelcome from "../components/chat/AgentWelcome";
import ChatLayout from "../components/chat/ChatLayout";
import Composer from "../components/chat/Composer";
import SessionSidebar from "../components/chat/SessionSidebar";
import { SessionProvider } from "../lib/session-context";
import { useChatPage } from "../lib/use-chat-page";

export default function ChatPage() {
  const router = useRouter();
  const chat = useChatPage();

  if (chat.ready && !chat.token) {
    return null;
  }

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
    />
  );

  const chatPanel = (
    <section className="agent-chat">
      <header className="agent-chat-header cf-animate-in">
        <div>
          <h1>AI product partner</h1>
          <p className="small">
            {chat.sessionId
              ? "Describe what you need — PRD, plan, build, fix bugs, or security review."
              : "Tell us your app idea. No coding experience required."}
          </p>
        </div>
        {chat.usage ? (
          <span className="usage-pill small cf-pulse-soft">{chat.usage.requests_remaining ?? 0} requests left</span>
        ) : null}
      </header>

      {chat.sessionId ? (
        <AgentToolsPanel
          sessionId={chat.sessionId}
          loading={chat.loading}
          sessionWritable={chat.sessionWritable}
          activeFile={chat.activeFile}
          onActiveFileChange={chat.setActiveFile}
          gitSummary={chat.gitSummary}
          onRefreshGit={chat.handleRefreshGit}
          shellCommand={chat.shellCommand}
          onShellCommandChange={chat.setShellCommand}
          onRunShell={chat.handleRunShell}
          shellOutput={chat.shellOutput}
          shellRunning={chat.shellRunning}
          symbolQuery={chat.symbolQuery}
          onSymbolQueryChange={chat.setSymbolQuery}
          onSearchSymbols={chat.handleSearchSymbols}
          symbolResults={chat.symbolResults}
          webQuery={chat.webQuery}
          onWebQueryChange={chat.setWebQuery}
          onWebSearch={chat.handleWebSearch}
          webResults={chat.webResults}
          workspaceFiles={chat.workspaceFiles}
          onRefreshFiles={chat.handleRefreshFiles}
          showConflictTool={chat.showConflictTool}
          onToggleConflictTool={() => chat.setShowConflictTool((open) => !open)}
          conflictTargetBranch={chat.conflictTargetBranch}
          onConflictTargetBranchChange={chat.setConflictTargetBranch}
          conflictGuide={chat.conflictGuide}
          conflictStrategy={chat.conflictStrategy}
          onConflictStrategyChange={chat.setConflictStrategy}
          conflictPaths={chat.conflictPaths}
          onConflictPathsChange={chat.setConflictPaths}
          onLoadConflictGuide={chat.handleLoadConflictGuide}
          onApplyConflict={chat.handleApplyConflictAssist}
          showWorkflows={chat.showWorkflows}
          onToggleWorkflows={() => chat.setShowWorkflows((open) => !open)}
          loopVerify={chat.loopVerify}
          onLoopVerifyChange={chat.setLoopVerify}
          loopPrompt={chat.loopPrompt}
          onLoopPromptChange={chat.setLoopPrompt}
          loopMaxAttempts={chat.loopMaxAttempts}
          onLoopMaxAttemptsChange={chat.setLoopMaxAttempts}
          loopRunning={chat.loopRunning}
          onRunLoop={chat.handleRunLoop}
          planTargets={chat.planTargets}
          onPlanTargetsChange={chat.setPlanTargets}
          autoMode={chat.autoMode}
          onAutoModeChange={chat.setAutoMode}
          onCompact={chat.handleCompact}
          onUltrareview={chat.handleUltrareview}
          onFork={chat.handleForkSession}
          onCreatePlan={chat.handleCreatePlan}
          onExecutePlan={chat.handleExecutePlan}
          onRollbackPlan={chat.handleRollbackPlan}
          activePlanId={chat.activePlanId}
          workflowOutput={chat.workflowOutput}
          templateName={chat.templateName}
          onTemplateNameChange={chat.setTemplateName}
          templatePrefix={chat.templatePrefix}
          onTemplatePrefixChange={chat.setTemplatePrefix}
          onCreateTemplate={chat.handleCreateTemplate}
          templates={chat.templates}
          onRunTemplate={chat.handleRunTemplate}
          selectedTemplateId={chat.selectedTemplateId}
          onStageAll={chat.handleStageAll}
          onGitStatus={chat.handleGitStatus}
          onGitDiff={chat.handleGitDiff}
          onGitCommit={chat.handleGitCommit}
          commitMessage={chat.commitMessage}
          onCommitMessageChange={chat.setCommitMessage}
          planMode={chat.planMode}
          onPlanModeChange={chat.setPlanMode}
          permissionMode={chat.permissionMode}
          onPermissionModeChange={chat.setPermissionMode}
          onExecuteAgentPlan={chat.handleExecuteAgentPlan}
          onGitPush={chat.handleGitPush}
          onCreatePr={chat.handleCreatePr}
          prTitle={chat.prTitle}
          onPrTitleChange={chat.setPrTitle}
          pushBranch={chat.pushBranch}
          onPushBranchChange={chat.setPushBranch}
          checkpoints={chat.checkpoints}
          onRefreshCheckpoints={chat.handleRefreshCheckpoints}
          onRewindCheckpoint={chat.handleRewindCheckpoint}
        />
      ) : null}

      <div className="agent-chat-log">
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

      {chat.pendingProposal && chat.sessionId ? (
        <div className="agent-inline-activity">
          <AgentActivityFeed agentEvents={chat.agentEvents} pendingProposal={chat.pendingProposal} />
        </div>
      ) : null}

      <Composer
        prompt={chat.prompt}
        onPromptChange={chat.setPrompt}
        onSubmit={chat.handleSendPrompt}
        canSend={chat.canSend}
        loading={chat.loading}
        sessionId={chat.sessionId}
      />
    </section>
  );

  return (
    <SessionProvider sessionId={chat.sessionId} sessions={chat.sessionHistory}>
      <ChatLayout sidebar={sidebar} chat={chatPanel} />
    </SessionProvider>
  );
}
