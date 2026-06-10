"use client";

import AgentActivityFeed from "../components/chat/AgentActivityFeed";
import ArtifactPanel from "../components/chat/ArtifactPanel";
import ChatLayout from "../components/chat/ChatLayout";
import Composer from "../components/chat/Composer";
import ConflictAssistant from "../components/chat/ConflictAssistant";
import { ChatMessageList } from "@codeforge/ui";
import RoutingSignalBanner from "../components/chat/RoutingSignalBanner";
import SessionSidebar from "../components/chat/SessionSidebar";
import WorkflowDrawer from "../components/chat/WorkflowDrawer";
import { SessionProvider } from "../lib/session-context";
import { useChatPage } from "../lib/use-chat-page";

export default function ChatPage() {
  const chat = useChatPage();

  if (chat.ready && !chat.token) {
    return null;
  }

  const sidebar = (
    <>
      <SessionSidebar
        projectPath={chat.projectPath}
        onProjectPathChange={chat.setProjectPath}
        onCreateSession={chat.handleCreateSession}
        sessionId={chat.sessionId}
        sessionHistory={chat.sessionHistory}
        onSelectSession={chat.handleSelectSession}
        loading={chat.loading}
        usage={chat.usage}
        lastModel={chat.lastModel}
        sessionFilter={chat.sessionFilter}
        onSessionFilterChange={chat.setSessionFilter}
        sessionWritable={chat.sessionWritable}
        currentSession={chat.currentSession}
      />
      <section className="panel mt-9">
        <WorkflowDrawer
          showWorkflows={chat.showWorkflows}
          onToggle={() => chat.setShowWorkflows((prev) => !prev)}
          sessionId={chat.sessionId}
          loading={chat.loading}
          sessionWritable={chat.sessionWritable}
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
          onRunTemplate={chat.setSelectedTemplateId}
          selectedTemplateId={chat.selectedTemplateId}
        />
        {chat.showWorkflows ? (
          <>
            <h4 className="small mt-8">Artifacts preview</h4>
            <ArtifactPanel
              artifacts={chat.artifacts}
              selectedArtifactId={chat.selectedArtifactId}
              artifactPreviewHtml={chat.artifactPreviewHtml}
              loading={chat.loading}
              onPreview={chat.handlePreviewArtifact}
            />
          </>
        ) : null}
        <ConflictAssistant
          show={chat.showConflictTool}
          onToggle={() => chat.setShowConflictTool((prev) => !prev)}
          conflictTargetBranch={chat.conflictTargetBranch}
          onConflictTargetBranchChange={chat.setConflictTargetBranch}
          conflictGuide={chat.conflictGuide}
          conflictStrategy={chat.conflictStrategy}
          onConflictStrategyChange={chat.setConflictStrategy}
          conflictPaths={chat.conflictPaths}
          onConflictPathsChange={chat.setConflictPaths}
          sessionId={chat.sessionId}
          loading={chat.loading}
          sessionWritable={chat.sessionWritable}
          onLoadGuide={chat.handleLoadConflictGuide}
          onApply={chat.handleApplyConflictAssist}
        />
      </section>
    </>
  );

  const chatPanel = (
    <section className="panel chat-panel">
      <h2>Chat</h2>
      <RoutingSignalBanner signal={chat.routingSignal} />
      <ChatMessageList
        variant="web"
        messages={chat.messages}
        chatEndRef={chat.chatEndRef}
        streamingMessageId={chat.streamingMessageId}
        sessionId={chat.sessionId}
        loading={chat.loading}
      />
      <Composer
        prompt={chat.prompt}
        onPromptChange={chat.setPrompt}
        onSubmit={chat.handleSendPrompt}
        canSend={chat.canSend}
        loading={chat.loading}
        sessionId={chat.sessionId}
        selectedTemplateId={chat.selectedTemplateId}
        onTemplateChange={chat.setSelectedTemplateId}
        templates={chat.templates}
      />
    </section>
  );

  const activity = (
    <AgentActivityFeed
      agentEvents={chat.agentEvents}
      pendingProposal={chat.pendingProposal}
      onDecision={chat.handleProposalDecision}
      loading={chat.loading}
    />
  );

  return (
    <SessionProvider sessionId={chat.sessionId} sessions={chat.sessionHistory}>
      <ChatLayout sidebar={sidebar} chat={chatPanel} activity={activity} />
    </SessionProvider>
  );
}
