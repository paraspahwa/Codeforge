"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const BENEFITS = [
  {
    id: "intelligence",
    title: "Real-Time Intelligence",
    description: "Agents read your repo, terminal output, and Magic Pointer context — then act with full situational awareness.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    id: "impact",
    title: "Measurable Impact",
    description: "Loop Engineering runs tests after every change. Verify/fix cycles until green — with audit trails you can trust.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    id: "integration",
    title: "Seamless Integration",
    description: "Web IDE, terminal CLI, VS Code, and Docker microservices — one API, one agent contract, zero copy-paste.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 17h7M17.5 14v7" />
      </svg>
    ),
  },
];

export default function LandingBenefits() {
  return (
    <section className="landing-benefits landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Why CodeForge</span>
          <h2>Built for teams that ship with AI</h2>
          <p>Automation that respects your codebase — not generic chat replies.</p>
        </ScrollReveal>

        <div className="landing-benefits-grid">
          {BENEFITS.map((item, index) => (
            <ScrollReveal key={item.id} delayClass={`landing-reveal-delay-${index + 1}`}>
              <article className="landing-benefit-card landing-glass landing-glow-border">
                <div className="landing-benefit-icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
