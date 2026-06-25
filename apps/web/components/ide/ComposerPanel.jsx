"use client";

import { useEffect, useRef } from "react";

import { ChatMessageList, Icon } from "@codeforge/ui";

import ChatAttachments, { ComposerAttachmentChips } from "../chat/ChatAttachments";
import ProposalReview from "../chat/ProposalReview";
import CodebaseSearchPanel from "../code/CodebaseSearchPanel";
import MagicPointerChips from "./MagicPointerChips";

const MODES = ["Agent", "Ask", "Plan"];
const MODELS = ["auto", "gpt-4o-mini", "gpt-4o"];

export default function ComposerPanel({ ws, onClose }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 180)}px`;
  }, [ws.prompt]);

  return (
    <aside className="ide-composer-panel">
      <header className="ide-composer-bar">
        <div className="ide-composer-bar-lead">
          <span className="ide-composer-bar-title">Composer</span>
          <select
            className="ide-composer-select"
            value={ws.composerMode}
            onChange={(event) => ws.setComposerMode(event.target.value)}
            aria-label="Composer mode"
          >
            {MODES.map((mode) => (
              <option key={mode} value={mode.toLowerCase()}>
                {mode}
              </option>
            ))}
          </select>
          <select
            className="ide-composer-select"
            value={ws.modelPreference}
            onChange={(event) => ws.setModelPreference(event.target.value)}
            aria-label="Model"
          >
            {MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="cf-icon-btn" onClick={onClose} aria-label="Close composer">
          <Icon name="X" size={16} />
        </button>
      </header>

      <div className="ide-composer-body">
        {ws.selection?.text ? (
          <p className="ide-selection-pill">
            {ws.selection.endLine - ws.selection.startLine + 1} lines · {ws.activePath}
          </p>
        ) : ws.magicPointerArmed ? (
          <p className="ide-selection-pill">Magic Pointer armed</p>
        ) : null}

        <MagicPointerChips
          entities={ws.pointerEntities}
          onAction={ws.handlePointerEntityAction}
          disabled={ws.loading}
        />

        <div className="ide-composer-messages">
          <ChatMessageList messages={ws.messages} />
        </div>

        {ws.pendingProposal ? (
          <ProposalReview
            pendingProposal={ws.pendingProposal}
            onDecision={ws.handleProposalDecision}
            loading={ws.loading}
          />
        ) : null}

        {ws.showMentionPicker ? (
          <CodebaseSearchPanel
            sessionId={ws.sessionId}
            loading={ws.loading}
            onSearchSymbols={ws.handleSearchSymbols}
            onSearchKnowledge={ws.handleSearchKnowledge}
            onOpenFile={ws.openFileAt}
            onInsertMention={ws.handleInsertMention}
          />
        ) : null}
      </div>

      <footer className="ide-composer-footer">
        <form onSubmit={ws.handleSendPrompt} className="cf-composer-bar ide-composer-input-bar">
          <ComposerAttachmentChips
            attachedFiles={ws.attachedFiles}
            onRemove={ws.handleRemoveAttachment}
            loading={ws.loading}
          />
          <div className="cf-composer-row">
            <ChatAttachments
              inline
              attachedFiles={ws.attachedFiles}
              onRemove={ws.handleRemoveAttachment}
              onAttachWorkspaceFile={ws.handleAttachWorkspaceFile}
              onUploadFiles={ws.handleUploadAttachments}
              workspaceFiles={ws.workspaceFiles}
              loading={ws.loading}
              disabled={!ws.sessionWritable || !ws.sessionId}
            />
            <textarea
              ref={textareaRef}
              rows={1}
              className="cf-composer-input ide-composer-textarea"
              value={ws.prompt}
              onChange={(event) => ws.setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "@") {
                  ws.setShowMentionPicker(true);
                }
                if (event.key === "/" && ws.prompt === "") {
                  ws.setShowSlashHint(true);
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (ws.canSend) {
                    ws.handleSendPrompt(event);
                  }
                }
              }}
              placeholder="Plan, build, @ context…"
              disabled={!ws.sessionWritable || ws.loading}
            />
            <div className="cf-composer-trailing">
              <button
                type="button"
                className="cf-icon-btn cf-composer-attach"
                onClick={() => ws.setShowMentionPicker((value) => !value)}
                aria-label="Insert context"
              >
                @
              </button>
              <button type="submit" className="cf-composer-send" disabled={!ws.canSend} aria-label="Send">
                {ws.loading ? (
                  <span className="cf-composer-send-loading" aria-hidden />
                ) : (
                  <Icon name="ArrowUp" size={18} />
                )}
              </button>
            </div>
          </div>
        </form>
        {ws.showSlashHint ? (
          <p className="ide-composer-foot small muted">Slash: /git, /compact, /help</p>
        ) : null}
        {ws.pendingProposal ? (
          <div className="ide-composer-proposal-actions">
            <button
              type="button"
              className="cf-status-pill cf-status-pill-subtle"
              onClick={() => ws.handleProposalDecision("reject")}
              disabled={ws.loading}
            >
              Reject
            </button>
            <button
              type="button"
              className="cf-status-pill"
              onClick={() => ws.handleProposalDecision("approve")}
              disabled={ws.loading}
            >
              Accept
            </button>
          </div>
        ) : null}
      </footer>
    </aside>
  );
}
