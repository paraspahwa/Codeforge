"use client";

import { BUILD_JOURNEY } from "../../lib/product-features";

const QUICK_STARTS = [
  {
    id: "idea",
    label: "I have an app idea",
    icon: "💡",
    prompt:
      "I have an app idea. Ask me questions to understand it, then tell me what we should do first.",
    color: "#f59e0b",
  },
  {
    id: "prd",
    label: "Write a PRD",
    icon: "📋",
    prompt:
      "Help me write a Product Requirements Document. Ask me about my app idea first, then create a clear PRD.",
    planMode: true,
    color: "#8b5cf6",
  },
  {
    id: "bug",
    label: "Fix a bug",
    icon: "🐛",
    prompt: "Something is broken. I'll describe the problem — help me fix it step by step.",
    color: "#ef4444",
  },
  {
    id: "security",
    label: "Security check",
    icon: "🛡️",
    prompt: "Review my project for security issues and explain any risks in plain language.",
    planMode: true,
    color: "#06b6d4",
  },
];

export default function AgentWelcome({ loading, onStartSession, onStartGoal, onExploreFeatures }) {
  return (
    <div className="agent-welcome agent-welcome-fun">
      <div className="agent-welcome-hero cf-animate-in">
        <p className="agent-welcome-kicker">
          <span className="cf-sparkle-inline" aria-hidden>✦</span>
          CodeForge
          <span className="cf-sparkle-inline cf-sparkle-delay" aria-hidden>✦</span>
        </p>
        <h2>What should we build today?</h2>
        <p className="agent-welcome-sub">
          No coding experience needed. Describe your idea and the AI guides you from PRD → plan → build → ship.
        </p>
      </div>

      <div className="journey-track cf-animate-in" style={{ animationDelay: "100ms" }}>
        {BUILD_JOURNEY.map((step, index) => (
          <div
            key={step.step}
            className="journey-step cf-animate-in"
            style={{ animationDelay: `${150 + index * 70}ms` }}
          >
            <div className="journey-step-dot" style={{ "--step-color": step.color }}>
              <span className="journey-step-icon">{step.icon}</span>
            </div>
            <div className="journey-step-text">
              <strong>{step.title}</strong>
              <span className="small">{step.description}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-start-grid cf-animate-in" style={{ animationDelay: "200ms" }}>
        <p className="quick-start-label">Quick start</p>
        <div className="quick-start-buttons">
          {QUICK_STARTS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="quick-start-btn cf-hover-lift cf-animate-in"
              style={{ animationDelay: `${250 + index * 60}ms`, "--btn-accent": item.color }}
              disabled={loading}
              onClick={() => onStartGoal({ starterPrompt: item.prompt, planMode: item.planMode })}
            >
              <span className="quick-start-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="agent-welcome-actions cf-animate-in" style={{ animationDelay: "350ms" }}>
        <button
          type="button"
          className="agent-welcome-cta cf-shimmer-btn"
          onClick={onStartSession}
          disabled={loading}
        >
          {loading ? "Starting…" : "Start a new chat"}
        </button>
        <button type="button" className="agent-welcome-secondary" onClick={onExploreFeatures} disabled={loading}>
          Explore all features →
        </button>
      </div>
    </div>
  );
}
