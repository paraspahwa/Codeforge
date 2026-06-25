"use client";

import { useState } from "react";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const FAQ_ITEMS = [
  {
    q: "Do I need to copy code into chat?",
    a: "No. Magic Pointer binds your editor selection and cursor to the agent session. Say “optimize this” and CodeForge resolves it from context.",
  },
  {
    q: "How does Loop Engineering work?",
    a: "After every code change, agents run your test suite automatically. On failure they diagnose, patch, and retry — up to 5 attempts — without waiting for you.",
  },
  {
    q: "Can I self-host CodeForge?",
    a: "Yes. The repo ships Docker Compose microservices (API, web, worker, gateway). Enterprise plans add SSO and custom model routing.",
  },
  {
    q: "What models are supported?",
    a: "Auto-routing picks the best tier for each task. Pro and Enterprise unlock frontier models with confidence signals and review gates.",
  },
  {
    q: "Is my code sent to third parties?",
    a: "You control API keys and deployment. See our Privacy page for data retention and subprocessors.",
  },
];

export default function LandingFaq() {
  const [openId, setOpenId] = useState(FAQ_ITEMS[0]?.q);

  return (
    <section id="faq" className="landing-faq landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">FAQ</span>
          <h2>Questions, answered</h2>
        </ScrollReveal>

        <div className="landing-faq-list">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openId === item.q;
            return (
              <ScrollReveal key={item.q} delayClass={`landing-reveal-delay-${Math.min(index + 1, 5)}`}>
                <article className={`landing-faq-item landing-glass ${isOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="landing-faq-question"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : item.q)}
                  >
                    {item.q}
                    <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen ? <p className="landing-faq-answer">{item.a}</p> : null}
                </article>
              </ScrollReveal>
            );
          })}
        </div>
      </LandingContainer>
    </section>
  );
}
