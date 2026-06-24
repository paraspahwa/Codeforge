"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const STEPS = [
  {
    num: "1",
    title: "Describe your idea",
    description: "Tell CodeForge what you want to build. No technical jargon needed — just your vision.",
  },
  {
    num: "2",
    title: "Plan with agents",
    description: "Get a PRD, architecture, and step-by-step plan. Pick from 30+ specialized agent patterns.",
  },
  {
    num: "3",
    title: "Build and ship",
    description: "Edit code in the IDE, run automations, and deploy with production-ready checklists.",
  },
];

export default function LandingHowItWorks() {
  return (
    <section className="landing-how landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Workflow</span>
          <h2>How it works</h2>
          <p>Three steps from idea to production — designed for founders, not just engineers.</p>
        </ScrollReveal>

        <ScrollReveal delayClass="landing-reveal-delay-1">
          <div className="landing-how-steps is-visible">
            {STEPS.map((step) => (
              <div key={step.num} className="landing-how-step">
                <div className="landing-how-num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </LandingContainer>
    </section>
  );
}
