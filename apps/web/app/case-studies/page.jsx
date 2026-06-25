"use client";

import Link from "next/link";

import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingPageHeader from "../../components/marketing/MarketingPageHeader";
import MarketingShell from "../../components/marketing/MarketingShell";
import { ScrollReveal } from "../../components/marketing/useScrollReveal";
import { CASE_STUDIES } from "../../lib/case-studies";

export default function CaseStudiesPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Stories"
        title="Builder case studies"
        lead="Journeys from Indian founders and dev teams using CodeForge — from idea to shipped software."
      />

      <section className="marketing-section mkt-content-section">
        <LandingContainer>
          <div className="case-studies-grid mkt-case-grid">
            {CASE_STUDIES.map((study, index) => (
              <ScrollReveal key={study.id} delayClass={`landing-reveal-delay-${Math.min(index + 1, 5)}`}>
                <article className="case-study-card mkt-case-card">
                  <header className="case-study-header">
                    <span className="case-study-category mkt-case-category">{study.category}</span>
                    <h2>{study.title}</h2>
                    <p className="small">
                      {study.founder} · {study.timeline}
                    </p>
                  </header>
                  <p>{study.summary}</p>
                  <ul className="case-study-metrics mkt-case-metrics">
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
                  <blockquote className="case-study-quote mkt-case-quote">&ldquo;{study.quote}&rdquo;</blockquote>
                </article>
              </ScrollReveal>
            ))}
          </div>

          <div className="roadmap-cta-row mkt-cta-row">
            <Link href="/editor" className="landing-btn landing-btn-primary mkt-btn-primary">
              Open editor
            </Link>
            <Link href="/roadmap" className="landing-btn landing-btn-secondary mkt-btn-secondary">
              View roadmap
            </Link>
          </div>
        </LandingContainer>
      </section>
    </MarketingShell>
  );
}
