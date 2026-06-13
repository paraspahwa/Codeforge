"use client";

import { useEffect, useRef } from "react";

import { viewOnlySessionMessage } from "@codeforge/shared/sessions";

import { useSessionAccess } from "../../lib/session-context";

export default function Composer({
  prompt,
  onPromptChange,
  onSubmit,
  canSend,
  loading,
  sessionId,
}) {
  const { currentSession, sessionWritable } = useSessionAccess();
  const textareaRef = useRef(null);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
  }, [prompt]);

  return (
    <form onSubmit={onSubmit} className="agent-composer">
      {!sessionWritable && currentSession ? (
        <p className="small agent-composer-hint">{viewOnlySessionMessage(currentSession)}</p>
      ) : null}
      {!sessionId ? (
        <p className="small agent-composer-hint">
          Pick a quick-start above or click <strong>Start a new chat</strong> to begin.
        </p>
      ) : null}
      <div className="agent-composer-row">
        <textarea
          ref={textareaRef}
          rows={1}
          className="agent-composer-input"
          placeholder="Describe your app idea, a bug, or what you want to build…"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) {
                onSubmit(event);
              }
            }
          }}
          disabled={!sessionId || loading || !sessionWritable}
        />
        <button type="submit" className="agent-send-btn cf-shimmer-btn" disabled={!canSend} aria-label="Send message">
          {loading ? "…" : "↑"}
        </button>
      </div>
      <p className="small agent-composer-foot">
        Enter to send · Shift+Enter for new line · The AI guides you step by step
      </p>
    </form>
  );
}
