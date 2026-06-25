"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const QUOTES = [
  {
    text: "The autonomy slider matters — tab completion when you want speed, full agent mode when you want delegation.",
    author: "Product engineering lead",
  },
  {
    text: "Loop Engineering caught regressions before review. Our verify command runs after every agent pass.",
    author: "Indie SaaS founder",
  },
];

export default function LandingProof() {
  return (
    <section className="landing-proof landing-section-block mkt-section mkt-proof">
      <LandingContainer>
        <ScrollReveal className="mkt-section-header mkt-section-header--compact">
          <p className="mkt-eyebrow">Trusted by builders</p>
          <h2>The new way to ship software</h2>
        </ScrollReveal>
        <div className="mkt-quote-grid">
          {QUOTES.map((item) => (
            <ScrollReveal key={item.author}>
              <blockquote className="mkt-quote-card">
                <p>{item.text}</p>
                <footer>{item.author}</footer>
              </blockquote>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal delayClass="landing-reveal-delay-2">
          <ul className="mkt-stat-row" aria-label="Platform metrics">
            <li>
              <strong>3</strong>
              <span>surfaces — web, CLI, VS Code</span>
            </li>
            <li>
              <strong>30+</strong>
              <span>specialized agents</span>
            </li>
            <li>
              <strong>INR</strong>
              <span>pricing via Razorpay</span>
            </li>
          </ul>
        </ScrollReveal>
      </LandingContainer>
    </section>
  );
}
