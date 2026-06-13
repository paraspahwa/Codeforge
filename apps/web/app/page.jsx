"use client";

import { ChatMessageList } from "@codeforge/ui";

import AgentActivityFeed from "../components/chat/AgentActivityFeed";
import ChatLayout from "../components/chat/ChatLayout";
import Composer from "../components/chat/Composer";
import SessionSidebar from "../components/chat/SessionSidebar";
import { SessionProvider } from "../lib/session-context";
import { useChatPage } from "../lib/use-chat-page";

export default function ChatPage() {
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
      <header className="agent-chat-header">
        <div>
          <h1>Coding agent</h1>
          <p className="small">
            {chat.sessionId
              ? "Ask for code — I'll write files and show the result right here."
              : "Start a session, then chat like you would with a senior engineer."}
          </p>
        </div>
        {chat.usage ? (
          <span className="usage-pill small">{chat.usage.requests_remaining ?? 0} requests left</span>
        ) : null}
      </header>

      <div className="agent-chat-log">
        {!chat.sessionId ? (
          <div className="agent-welcome">
            <p className="agent-welcome-kicker">CodeForge</p>
            <h2>What should we build?</h2>
            <ul className="agent-welcome-list">
              <li>Generate Python, APIs, and scripts in real files</li>
              <li>See full code blocks inline — no manual approve step</li>
              <li>Debug errors and refactor across your workspace</li>
            </ul>
            <button type="button" className="agent-welcome-cta" onClick={chat.handleCreateSession} disabled={chat.loading}>
              {chat.loading ? "Starting…" : "Start coding session"}
            </button>
          </div>
        ) : (
          <ChatMessageList
            variant="web"
            messages={chat.messages}
            chatEndRef={chat.chatEndRef}
            streamingMessageId={chat.streamingMessageId}
            sessionId={chat.sessionId}
            loading={chat.loading}
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
