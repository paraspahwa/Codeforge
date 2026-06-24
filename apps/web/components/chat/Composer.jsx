"use client";

import { useEffect, useRef, useState } from "react";

import { viewOnlySessionMessage } from "@codeforge/shared/sessions";

import ChatAttachments from "./ChatAttachments";
import VoiceInputButton from "./VoiceInputButton";
import { useSessionAccess } from "../../lib/session-context";
import { getLocale, t } from "../../lib/locale-copy";

export default function Composer({
  prompt,
  onPromptChange,
  onSubmit,
  canSend,
  loading,
  sessionId,
  attachedFiles = [],
  onRemoveAttachment,
  onAttachWorkspaceFile,
  onUploadAttachments,
  workspaceFiles = [],
}) {
  const { currentSession, sessionWritable } = useSessionAccess();
  const textareaRef = useRef(null);
  const [locale, setLocaleState] = useState("en");

  useEffect(() => {
    setLocaleState(getLocale());
    function onLocaleChange() {
      setLocaleState(getLocale());
    }
    window.addEventListener("codeforge:locale-change", onLocaleChange);
    return () => window.removeEventListener("codeforge:locale-change", onLocaleChange);
  }, []);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
  }, [prompt]);

  function handleVoiceTranscript(text) {
    const next = prompt ? `${prompt.trimEnd()} ${text}` : text;
    onPromptChange(next);
  }

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
      {sessionId ? (
        <ChatAttachments
          attachedFiles={attachedFiles}
          onRemove={onRemoveAttachment}
          onAttachWorkspaceFile={onAttachWorkspaceFile}
          onUploadFiles={onUploadAttachments}
          workspaceFiles={workspaceFiles}
          loading={loading}
          disabled={!sessionWritable}
        />
      ) : null}
      <div className="agent-composer-row">
        <VoiceInputButton
          disabled={!sessionId || loading || !sessionWritable}
          onTranscript={handleVoiceTranscript}
        />
        <textarea
          ref={textareaRef}
          rows={1}
          className="agent-composer-input"
          placeholder={t("composerPlaceholder", locale)}
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
      <p className="small agent-composer-foot">{t("composerHint", locale)}</p>
    </form>
  );
}
