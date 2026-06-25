"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@codeforge/ui";
import { viewOnlySessionMessage } from "@codeforge/shared/sessions";

import ChatAttachments, { ComposerAttachmentChips } from "./ChatAttachments";
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
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [prompt]);

  function handleVoiceTranscript(text) {
    const next = prompt ? `${prompt.trimEnd()} ${text}` : text;
    onPromptChange(next);
  }

  const showBar = Boolean(sessionId);

  return (
    <div className="cf-composer-dock agent-composer">
      {!sessionWritable && currentSession ? (
        <p className="cf-composer-notice">{viewOnlySessionMessage(currentSession)}</p>
      ) : null}
      {!sessionId ? (
        <p className="cf-composer-notice">Start a chat from the sidebar to begin.</p>
      ) : null}

      {showBar ? (
        <form className="cf-composer-bar" onSubmit={onSubmit}>
          <ComposerAttachmentChips
            attachedFiles={attachedFiles}
            onRemove={onRemoveAttachment}
            loading={loading}
          />
          <div className="cf-composer-row">
            <ChatAttachments
              inline
              attachedFiles={attachedFiles}
              onRemove={onRemoveAttachment}
              onAttachWorkspaceFile={onAttachWorkspaceFile}
              onUploadFiles={onUploadAttachments}
              workspaceFiles={workspaceFiles}
              loading={loading}
              disabled={!sessionWritable}
            />
            <textarea
              ref={textareaRef}
              rows={1}
              className="cf-composer-input agent-composer-input"
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
              disabled={loading || !sessionWritable}
            />
            <div className="cf-composer-trailing">
              <VoiceInputButton
                disabled={loading || !sessionWritable}
                onTranscript={handleVoiceTranscript}
              />
              <button
                type="submit"
                className="cf-composer-send"
                disabled={!canSend}
                aria-label="Send message"
                title="Send (Enter)"
              >
                {loading ? (
                  <span className="cf-composer-send-loading" aria-hidden />
                ) : (
                  <Icon name="ArrowUp" size={18} />
                )}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {showBar ? (
        <p className="cf-composer-foot">{t("composerHint", locale)}</p>
      ) : null}
    </div>
  );
}
