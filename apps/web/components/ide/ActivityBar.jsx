"use client";

import Link from "next/link";

import { Icon } from "@codeforge/ui";

const VIEWS = [
  { id: "explorer", label: "Explorer", icon: "FolderOpen" },
  { id: "search", label: "Search", icon: "Search" },
  { id: "scm", label: "Source Control", icon: "GitBranch" },
  { id: "run", label: "Run", icon: "Zap" },
  { id: "extensions", label: "Extensions", icon: "Plug" },
  { id: "settings", label: "Settings", icon: "Settings" },
];

export default function ActivityBar({ activeView, onChange, onToggleComposer, composerOpen }) {
  return (
    <nav className="ide-activity-bar" aria-label="Activity bar">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          className={`ide-activity-btn ${activeView === view.id ? "ide-activity-btn-active" : ""}`}
          title={view.label}
          aria-label={view.label}
          aria-pressed={activeView === view.id}
          onClick={() => onChange(view.id)}
        >
          <Icon name={view.icon} size={18} />
        </button>
      ))}
      <div className="ide-activity-spacer" />
      <button
        type="button"
        className={`ide-activity-btn ${composerOpen ? "ide-activity-btn-active" : ""}`}
        title="Composer"
        aria-label="Toggle Composer"
        onClick={onToggleComposer}
      >
        <Icon name="Sparkles" size={18} />
      </button>
    </nav>
  );
}
