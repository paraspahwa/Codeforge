"use client";

import Link from "next/link";

import { AUDIENCES } from "../../lib/product-roadmap";
import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

export default function LandingAudiences() {
  return (
    <section id="audiences" className="landing-audiences landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Who it&apos;s for</span>
          <h2>Built for how you build</h2>
          <p>Whether you&apos;re sketching an idea on a napkin or shipping production code — CodeForge meets you where you are.</p>
        </ScrollReveal>

        <div className="landing-audience-grid">
          {AUDIENCES.map((audience, index) => (
            <ScrollReveal key={audience.id} delayClass={`landing-reveal-delay-${Math.min(index + 1, 3)}`}>
              <article className="landing-audience-card landing-glass landing-glow-border">
                <span className="landing-audience-emoji" aria-hidden="true">
                  {audience.emoji}
                </span>
                <h3>{audience.title}</h3>
                <p>{audience.description}</p>
                <ul className="landing-audience-highlights">
                  {audience.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link href={audience.cta.href} className="landing-btn landing-btn-secondary landing-audience-cta">
                  {audience.cta.label}
                </Link>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
