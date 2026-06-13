"use client";

import { useRef } from "react";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.md,.markdown,.txt,.json,.yaml,.yml,.csv,.html,.htm,.py,.js,.ts,.tsx,.jsx";

export default function ChatAttachments({
  attachedFiles,
  onRemove,
  onAttachWorkspaceFile,
  onUploadFiles,
  workspaceFiles = [],
  loading,
  disabled,
}) {
  const inputRef = useRef(null);

  return (
    <div className="chat-attachments">
      <div className="chat-attachments-toolbar">
        <button
          type="button"
          className="ghost-btn small chat-attach-btn"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || loading}
        >
          📎 Attach files
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
        <span className="small muted">PDF, images, Markdown, code, JSON…</span>
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
