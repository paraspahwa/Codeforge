"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const MODELS = [
  { id: "deepseek-v4-flash", label: "deepseek-v4-flash", primary: true },
  { id: "deepseek-v4-pro", label: "deepseek-v4-pro", primary: false },
  { id: "claude-sonnet", label: "claude-sonnet-4.6", primary: false },
  { id: "gpt-4o-mini", label: "gpt-4o-mini", primary: false },
  { id: "claude-opus", label: "claude-opus-4.1", primary: false },
];

export default function LandingModelStrip() {
  return (
    <section className="landing-models landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Models</span>
          <h2>Use the best model for every task</h2>
          <p>Intelligent routing picks the right model for speed, complexity, and cost — automatically.</p>
        </ScrollReveal>

        <ScrollReveal delayClass="landing-reveal-delay-2">
          <div className="landing-model-badges">
            {MODELS.map((model) => (
              <span
                key={model.id}
                className={`landing-model-badge ${model.primary ? "landing-model-badge--primary" : ""}`}
              >
                {model.label}
              </span>
            ))}
          </div>
        </ScrollReveal>
      </LandingContainer>
    </section>
  );
}
