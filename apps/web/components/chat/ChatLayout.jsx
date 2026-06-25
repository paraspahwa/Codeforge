"use client";

import { Icon } from "@codeforge/ui";

export default function ChatLayout({
  sidebar,
  chat,
  contextPanel,
  contextOpen,
  onCloseContext,
}) {
  return (
    <div
      className={`product-workspace agent-layout${contextOpen ? " product-workspace--context-open" : ""}`}
    >
      <div className="product-workspace-sidebar agent-layout-sidebar">{sidebar}</div>
      <div className="product-workspace-main agent-layout-main">{chat}</div>
      {contextOpen ? (
        <aside className="product-workspace-context" aria-label="Context panel">
          <div className="product-workspace-context-header">
            <span className="product-workspace-context-title">Context</span>
            <button
              type="button"
              className="cf-icon-btn cf-icon-btn-ghost product-workspace-context-close"
              onClick={onCloseContext}
              aria-label="Close context panel"
            >
              <Icon name="X" size={16} />
            </button>
          </div>
          <div className="product-workspace-context-inner">{contextPanel}</div>
        </aside>
      ) : null}
    </div>
  );
}
