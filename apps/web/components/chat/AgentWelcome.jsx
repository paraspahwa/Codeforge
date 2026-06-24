"use client";

import { useEffect, useState } from "react";

import { BUILD_JOURNEY } from "../../lib/product-features";
import { t, getLocale } from "../../lib/locale-copy";
import BuildJourneyProgress from "./BuildJourneyProgress";

const QUICK_STARTS = [
  {
    id: "idea",
    label: "I have an app idea",
    labelHinglish: "Mere paas app idea hai",
    icon: "💡",
    prompt:
      "I have an app idea. Ask me questions to understand it, then tell me what we should do first.",
    color: "#f59e0b",
  },
  {
    id: "prd",
    label: "Write a PRD",
    labelHinglish: "PRD likho",
    icon: "📋",
    prompt:
      "Help me write a PRD for my app idea. Ask me 4-5 clarifying questions first — do NOT write the PRD yet.",
    color: "#8b5cf6",
  },
  {
    id: "saas",
    label: "India SaaS starter",
    labelHinglish: "India SaaS starter",
    icon: "₹",
    prompt:
      "Use templates/india-saas-starter as the base. Help me customize a B2B SaaS with Supabase auth and Razorpay INR billing.",
    planMode: true,
    color: "#10b981",
  },
  {
    id: "bug",
    label: "Fix a bug",
    labelHinglish: "Bug fix karo",
    icon: "🐛",
    prompt: "Something is broken. I'll describe the problem — help me fix it step by step.",
    color: "#ef4444",
  },
];

export default function AgentWelcome({ loading, onStartSession, onStartGoal, onExploreFeatures }) {
  const [locale, setLocaleState] = useState("en");

  useEffect(() => {
    setLocaleState(getLocale());
    function onLocaleChange() {
      setLocaleState(getLocale());
    }
    window.addEventListener("codeforge:locale-change", onLocaleChange);
    return () => window.removeEventListener("codeforge:locale-change", onLocaleChange);
  }, []);

  const hinglish = locale === "hinglish";

  return (
    <div className="agent-welcome agent-welcome-fun">
      <div className="agent-welcome-hero cf-animate-in">
        <p className="agent-welcome-kicker">
          <span className="cf-sparkle-inline" aria-hidden>✦</span>
          CodeForge
          <span className="cf-sparkle-inline cf-sparkle-delay" aria-hidden>✦</span>
        </p>
        <h2>{t("welcomeTitle", locale)}</h2>
        <p className="agent-welcome-sub">{t("welcomeSub", locale)}</p>
      </div>

      <BuildJourneyProgress />

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
        <p className="quick-start-label">{t("quickStartLabel", locale)}</p>
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
              {hinglish && item.labelHinglish ? item.labelHinglish : item.label}
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
          {loading ? "Starting…" : t("startChat", locale)}
        </button>
        <button type="button" className="agent-welcome-secondary" onClick={onExploreFeatures} disabled={loading}>
          {t("exploreFeatures", locale)}
        </button>
      </div>
    </div>
  );
}
