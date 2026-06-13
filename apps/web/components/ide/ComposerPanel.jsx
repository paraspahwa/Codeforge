"use client";

import { ChatMessageList } from "@codeforge/ui";

import ChatAttachments from "../chat/ChatAttachments";
import ProposalReview from "../chat/ProposalReview";
import CodebaseSearchPanel from "../code/CodebaseSearchPanel";

const MODES = ["Agent", "Ask", "Plan"];
const MODELS = ["auto", "gpt-4o-mini", "gpt-4o"];

export default function ComposerPanel({
  ws,
  onClose,
}) {
  return (
    <aside className="ide-composer-panel">
      <div className="ide-composer-header">
        <h3>Composer</h3>
        <div className="ide-composer-controls">
          <select
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
          <button type="button" className="ghost-btn small" onClick={onClose}>
            Hide
          </button>
        </div>
      </div>

      {ws.selection?.text ? (
        <p className="small ide-selection-pill">
          {ws.selection.endLine - ws.selection.startLine + 1} lines selected in {ws.activePath}
        </p>
      ) : null}

      <div className="code-chat-messages ide-composer-messages">
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

      <ChatAttachments
        attachedFiles={ws.attachedFiles}
        onRemove={ws.handleRemoveAttachment}
        onAttachWorkspaceFile={ws.handleAttachWorkspaceFile}
        onUploadFiles={ws.handleUploadAttachments}
        workspaceFiles={ws.workspaceFiles}
        loading={ws.loading}
        disabled={!ws.sessionWritable || !ws.sessionId}
      />

      <form onSubmit={ws.handleSendPrompt} className="ide-composer-form">
        <textarea
          rows={4}
          value={ws.prompt}
          onChange={(event) => ws.setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "@") {
              ws.setShowMentionPicker(true);
            }
            if (event.key === "/" && ws.prompt === "") {
              ws.setShowSlashHint(true);
            }
          }}
          placeholder="Plan, Build, / for skills, @ for context"
          disabled={!ws.sessionWritable || ws.loading}
        />
        {ws.showSlashHint ? (
          <p className="small muted">Slash commands: /git, /compact, /help — type in chat and send.</p>
        ) : null}
        <div className="ide-composer-actions">
          <button type="button" className="ghost-btn small" onClick={() => ws.setShowMentionPicker((v) => !v)}>
            @
          </button>
          <button type="submit" disabled={!ws.canSend}>
            Send
          </button>
          {ws.pendingProposal ? (
            <>
              <button type="button" className="ghost-btn small" onClick={() => ws.handleProposalDecision("reject")} disabled={ws.loading}>
                Reject
              </button>
              <button type="button" className="ghost-btn small" onClick={() => ws.handleProposalDecision("approve")} disabled={ws.loading}>
                Accept
              </button>
            </>
          ) : null}
        </div>
      </form>
    </aside>
  );
}
