"use client";

import { useRef } from "react";

import { Icon } from "@codeforge/ui";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.md,.markdown,.txt,.json,.yaml,.yml,.csv,.html,.htm,.py,.js,.ts,.tsx,.jsx";

const ACCEPT_TOOLTIP =
  "PDF, images, Markdown, text, JSON, YAML, CSV, HTML, Python, JavaScript, TypeScript";

export default function ChatAttachments({
  attachedFiles,
  onRemove,
  onAttachWorkspaceFile,
  onUploadFiles,
  workspaceFiles = [],
  loading,
  disabled,
  inline = false,
}) {
  const inputRef = useRef(null);

  if (inline) {
    return (
      <>
        <button
          type="button"
          className="cf-icon-btn cf-composer-attach"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || loading}
          title={ACCEPT_TOOLTIP}
          aria-label="Attach files"
        >
          <Icon name="Paperclip" size={16} />
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="chat-attach-input"
          onChange={(event) => {
            const picked = Array.from(event.target.files || []);
            if (picked.length > 0) {
              onUploadFiles(picked);
            }
            event.target.value = "";
          }}
        />
        {workspaceFiles.length > 0 ? (
          <details className="cf-composer-workspace-details">
            <summary className="cf-icon-btn" title="Attach from workspace" aria-label="Workspace files">
              <Icon name="Folder" size={16} />
            </summary>
            <div className="cf-composer-workspace-menu">
              {workspaceFiles.slice(0, 20).map((path) => (
                <button
                  key={path}
                  type="button"
                  className="cf-composer-workspace-item"
                  onClick={() => onAttachWorkspaceFile(path)}
                  disabled={disabled || loading || attachedFiles.includes(path)}
                >
                  {path.split("/").pop() || path}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </>
    );
  }

  return (
    <div className="chat-attachments">
      <div className="chat-attachments-toolbar">
        <button
          type="button"
          className="ghost-btn small chat-attach-btn"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || loading}
          title={ACCEPT_TOOLTIP}
        >
          Attach files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="chat-attach-input"
          onChange={(event) => {
            const picked = Array.from(event.target.files || []);
            if (picked.length > 0) {
              onUploadFiles(picked);
            }
            event.target.value = "";
          }}
        />
      </div>

      {workspaceFiles.length > 0 ? (
        <details className="chat-attach-workspace">
          <summary className="small">Attach from workspace</summary>
          <div className="chat-attach-workspace-list">
            {workspaceFiles.slice(0, 40).map((path) => (
              <button
                key={path}
                type="button"
                className="ghost-btn small"
                onClick={() => onAttachWorkspaceFile(path)}
                disabled={disabled || loading || attachedFiles.includes(path)}
              >
                {path}
              </button>
            ))}
          </div>
        </details>
      ) : null}

      {attachedFiles.length > 0 ? (
        <ul className="chat-attachment-chips">
          {attachedFiles.map((path) => (
            <li key={path} className="chat-attachment-chip">
              <span className="small" title={path}>
                {path.split("/").pop() || path}
              </span>
              <button
                type="button"
                className="chat-attachment-remove"
                onClick={() => onRemove(path)}
                disabled={loading}
                aria-label={`Remove ${path}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ComposerAttachmentChips({ attachedFiles, onRemove, loading }) {
  if (!attachedFiles?.length) {
    return null;
  }

  return (
    <div className="cf-composer-chips" aria-label="Attached files">
      {attachedFiles.map((path) => (
        <span key={path} className="cf-composer-chip" title={path}>
          <Icon name="Paperclip" size={12} />
          <span className="cf-composer-chip-label">{path.split("/").pop() || path}</span>
          <button
            type="button"
            className="cf-composer-chip-remove"
            onClick={() => onRemove(path)}
            disabled={loading}
            aria-label={`Remove ${path}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
