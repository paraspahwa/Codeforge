"use client";

import { useEffect, useRef } from "react";

import { Banner, Button } from "@codeforge/ui";
import { viewOnlySessionMessage } from "@codeforge/shared/sessions";

import { useSessionAccess } from "../../lib/session-context";

export default function Composer({
  prompt,
  onPromptChange,
  onSubmit,
  canSend,
  loading,
  sessionId,
  selectedTemplateId,
  onTemplateChange,
  templates,
}) {
  const { currentSession, sessionWritable } = useSessionAccess();
  const textareaRef = useRef(null);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 192)}px`;
  }, [prompt]);

  return (    <form onSubmit={onSubmit} className="chat-composer chat-panel-sticky mt-9">
      {!sessionWritable && currentSession ? <Banner>{viewOnlySessionMessage(currentSession)}</Banner> : null}
      {templates?.length ? (
        <label className="small" htmlFor="template-select">
          Template
        </label>
      ) : null}
      {templates?.length ? (
        <select
          id="template-select"
          value={selectedTemplateId}
          onChange={(event) => onTemplateChange(event.target.value)}
          disabled={!sessionId || loading || !sessionWritable}
        >
          <option value="">No template</option>
          {templates.map((template) => (
            <option key={template.template_id} value={template.template_id}>
              {template.name}
            </option>
          ))}
        </select>
      ) : null}
      <textarea
        ref={textareaRef}
        rows={3}        placeholder="Ask CodeForge… or /memory, /taste, /caveman, /rtk, /help"
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
      <div className="mt-6">
        <Button type="submit" disabled={!canSend}>
          {loading ? "Streaming..." : "Send"}
        </Button>
      </div>
    </form>
  );
}
