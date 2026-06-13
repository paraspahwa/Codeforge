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
        <p className="small agent-composer-hint">Click <strong>Start coding</strong> in the sidebar to begin.</p>
      ) : null}
      <div className="agent-composer-row">
        <textarea
          ref={textareaRef}
          rows={1}
          className="agent-composer-input"
          placeholder="Ask me to write code, fix a bug, explain a file, or run a task…"
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
        <button type="submit" className="agent-send-btn" disabled={!canSend} aria-label="Send message">
          {loading ? "…" : "↑"}
        </button>
      </div>
      <p className="small agent-composer-foot">Enter to send · Shift+Enter for newline · slash commands: /help</p>
    </form>
  );
}
