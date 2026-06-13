"use client";

const VIEWS = [
  { id: "explorer", label: "Explorer", icon: "📁" },
  { id: "search", label: "Search", icon: "🔍" },
  { id: "scm", label: "Source Control", icon: "⎇" },
  { id: "run", label: "Run", icon: "▶" },
  { id: "extensions", label: "Extensions", icon: "🧩" },
  { id: "settings", label: "Settings", icon: "⚙" },
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
          <span aria-hidden="true">{view.icon}</span>
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
        <span aria-hidden="true">✨</span>
      </button>
    </nav>
  );
}
