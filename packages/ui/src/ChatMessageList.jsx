"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "./CodeBlock.jsx";

const markdownComponents = {
  code({ inline, className, children, ...props }) {
    if (inline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
};

const VARIANT_CONFIG = {
  web: {
    containerClass: "chat-log",
    itemTag: "div",
    itemClass: (role, active) => `msg ${role}${active ? " msg-active" : ""}`,
    bodyClass: (streaming) => `msg-content cf-markdown-body${streaming ? " streaming-cursor" : ""}`,
    userLabel: "You",
    assistantLabel: "CodeForge",
    emptyNoSession: "Create or select a session to start.",
    emptyNoMessages: "No messages yet. Ask CodeForge anything.",
  },
  desktop: {
    containerClass: "chat-log",
    itemTag: "article",
    itemClass: (role) => `chat-bubble chat-${role}`,
    bodyClass: (streaming) => `cf-markdown-body${streaming ? " streaming-cursor" : ""}`,
    userLabel: "You",
    assistantLabel: "CodeForge",
    emptyNoSession: "Create or select a session to start.",
    emptyNoMessages: "No messages yet. Ask for an edit or review.",
  },
  replay: {
    containerClass: "chat-log chat-log-tall",
    itemTag: "div",
    itemClass: (role, active) => `msg ${role}${active ? " msg-active" : ""}`,
    bodyClass: () => "msg-content cf-markdown-body",
    userLabel: "User",
    assistantLabel: "CodeForge",
    emptyNoMessages: "This session has no messages.",
    emptyNoSession: "This session has no messages.",
  },
};

function messageKey(message, index) {
  return message.id ?? message.message_id ?? `message-${index}`;
}

export function ChatMessageList({
  messages = [],
  chatEndRef,
  streamingMessageId,
  sessionId,
  loading = false,
  variant = "web",
  activeMessageIndex,
  renderFooter,
  className = "",
}) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.web;
  const ItemTag = config.itemTag;

  return (
    <div className={`${config.containerClass} ${className}`.trim()} aria-live="polite">
      {messages.length === 0 ? (
        <p className={variant === "desktop" ? "muted small" : "small"}>
          {sessionId ? config.emptyNoMessages : config.emptyNoSession}
        </p>
      ) : null}
      {messages.map((message, index) => {
        const key = messageKey(message, index);
        const role = message.role;
        const isStreaming = key === streamingMessageId || message.id === streamingMessageId;
        const isActive = typeof activeMessageIndex === "number" ? index === activeMessageIndex : false;
        const content = message.content ?? "";

        return (
          <ItemTag key={key} className={config.itemClass(role, isActive)}>
            <strong>{role === "user" ? config.userLabel : config.assistantLabel}</strong>
            <div className={config.bodyClass(isStreaming)}>
              {role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {content || (loading && isStreaming ? "…" : "...")}
                </ReactMarkdown>
              ) : (
                content
              )}
            </div>
            {renderFooter ? renderFooter(message, index) : null}
          </ItemTag>
        );
      })}
      {chatEndRef ? <div ref={chatEndRef} /> : null}
    </div>
  );
}
