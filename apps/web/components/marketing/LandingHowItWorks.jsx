"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const STEPS = [
  {
    num: "01",
    title: "Plan with context",
    description: "Composer reads your files, selection, and Magic Pointer context — @-mentions and slash commands included.",
  },
  {
    num: "02",
    title: "Build across files",
    description: "Agents edit multiple files, run terminal commands, and propose patches you approve in the IDE.",
  },
  {
    num: "03",
    title: "Verify and ship",
    description: "Loop Engineering runs your test suite after every change until green — no manual copy-paste.",
  },
];

export default function LandingHowItWorks() {
  return (
    <section id="workflow" className="landing-how landing-section-block mkt-section">
      <LandingContainer>
        <ScrollReveal className="landing-section-header mkt-section-header">
          <span className="landing-section-eyebrow mkt-eyebrow">Workflow</span>
          <h2>Plan → Build → Verify</h2>
          <p>Linear-style momentum with Cursor-style agent depth — in your browser.</p>
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
