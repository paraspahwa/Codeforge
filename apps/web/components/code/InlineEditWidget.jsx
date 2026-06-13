"use client";

import { useEffect, useRef, useState } from "react";

export default function InlineEditWidget({
  open,
  path,
  selection,
  loading,
  preview,
  onPromptChange,
  onSubmit,
  onAccept,
  onReject,
  onClose,
}) {
  const inputRef = useRef(null);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (open) {
      setPrompt("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const lineLabel =
    selection?.startLine && selection?.endLine
      ? `lines ${selection.startLine}-${selection.endLine}`
      : "selection";

  function handlePromptChange(value) {
    setPrompt(value);
    onPromptChange?.(value);
  }

  return (
    <div className="inline-edit-overlay" role="dialog" aria-label="Inline edit">
      <div className="inline-edit-card">
        <div className="inline-edit-header">
          <strong>Ctrl+K inline edit</strong>
          <span className="small muted">
            {path} · {lineLabel}
          </span>
          <button type="button" className="ghost-btn small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {selection?.text ? (
          <pre className="inline-edit-selection small">{selection.text.slice(0, 600)}</pre>
        ) : null}
        <textarea
          ref={inputRef}
          rows={2}
          value={prompt}
          onChange={(event) => handlePromptChange(event.target.value)}
          placeholder="Describe the change for the selected code…"
          disabled={loading}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && prompt.trim() && !loading) {
              event.preventDefault();
              onSubmit(prompt.trim());
            }
          }}
        />
        <div className="inline-edit-actions">
          <button type="button" onClick={() => onSubmit(prompt.trim())} disabled={!prompt.trim() || loading}>
            {loading ? "Generating…" : "Generate (Ctrl+Enter)"}
          </button>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
        {preview ? (
          <div className="inline-edit-preview">
            <div className="inline-edit-preview-header">
              <span className="small">Preview</span>
              <div className="inline-edit-preview-actions">
                <button type="button" className="ghost-btn small" onClick={onAccept} disabled={loading}>
                  Accept
                </button>
                <button type="button" className="ghost-btn small" onClick={onReject} disabled={loading}>
                  Reject
                </button>
              </div>
            </div>
            <pre className="proposal-preview diff-unified small">{preview}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
