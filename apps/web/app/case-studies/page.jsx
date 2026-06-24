"use client";

import Link from "next/link";

import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingShell from "../../components/marketing/MarketingShell";
import { ScrollReveal } from "../../components/marketing/useScrollReveal";
import { CASE_STUDIES } from "../../lib/case-studies";

export default function CaseStudiesPage() {
  return (
    <MarketingShell>
      <section className="landing-page-hero-band">
        <LandingContainer>
          <ScrollReveal immediate>
            <h1>Builder case studies</h1>
            <p className="landing-hero-lead">
              Real-style journeys from Indian founders and dev teams using CodeForge — from idea to shipped software.
            </p>
          </ScrollReveal>
        </LandingContainer>
      </section>

      <section className="marketing-section">
        <LandingContainer>
          <div className="case-studies-grid">
            {CASE_STUDIES.map((study, index) => (
              <ScrollReveal key={study.id} delayClass={`landing-reveal-delay-${Math.min(index + 1, 5)}`}>
                <article className="case-study-card landing-glass landing-glow-border">
                  <header className="case-study-header">
                    <span className="case-study-category">{study.category}</span>
                    <h2>{study.title}</h2>
                    <p className="small">
                      {study.founder} · {study.timeline}
                    </p>
                  </header>
                  <p>{study.summary}</p>
                  <ul className="case-study-metrics">
                    {study.metrics.map((metric) => (
                      <li key={metric.label}>
                        <strong>{metric.value}</strong>
                        <span className="small">{metric.label}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="case-study-stack small">
                    Stack: {study.stack.join(" · ")}
                  </p>
                  <blockquote className="case-study-quote">&ldquo;{study.quote}&rdquo;</blockquote>
                </article>
              </ScrollReveal>
            ))}
          </div>

          <div className="roadmap-cta-row">
            <Link href="/login?next=/app" className="landing-btn landing-btn-primary">
              Start your build
            </Link>
            <Link href="/roadmap" className="landing-btn landing-btn-secondary">
              View roadmap
            </Link>
          </div>
        </LandingContainer>
      </section>
    </MarketingShell>
  );
}
