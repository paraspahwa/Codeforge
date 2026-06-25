"use client";

import { Icon } from "@codeforge/ui";

export default function ChatContextPanel({
  activeTab,
  onTabChange,
  showTools,
  showPreview,
  showDeploy,
  tools,
  preview,
  deploy,
}) {
  const tabs = [
    showTools ? { id: "tools", label: "Tools", icon: "Zap" } : null,
    showPreview ? { id: "preview", label: "Preview", icon: "Globe" } : null,
    showDeploy ? { id: "deploy", label: "Deploy", icon: "Settings" } : null,
  ].filter(Boolean);

  if (tabs.length === 0) {
    return null;
  }

  const current = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0].id;

  return (
    <div className="cf-context-panel">
      <nav className="cf-context-panel-tabs" aria-label="Context panel">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`cf-context-tab ${current === tab.id ? "is-active" : ""}`}
            onClick={() => onTabChange(tab.id)}
            aria-selected={current === tab.id}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="cf-context-panel-body">
        {current === "tools" ? tools : null}
        {current === "preview" ? preview : null}
        {current === "deploy" ? deploy : null}
      </div>
    </div>
  );
}
