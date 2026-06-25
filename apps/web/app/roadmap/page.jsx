"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingPageHeader from "../../components/marketing/MarketingPageHeader";
import MarketingShell from "../../components/marketing/MarketingShell";
import { ScrollReveal } from "../../components/marketing/useScrollReveal";
import { getQualitySummary } from "../../lib/api";
import { PRIMARY_WEDGE, ROADMAP_PHASES, STATUS_LABELS } from "../../lib/product-roadmap";

function StatusBadge({ status }) {
  return <span className={`roadmap-status roadmap-status--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export default function RoadmapPage() {
  const [quality, setQuality] = useState(null);
  const [qualityError, setQualityError] = useState(false);

  useEffect(() => {
    getQualitySummary()
      .then(setQuality)
      .catch(() => setQualityError(true));
  }, []);

  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Roadmap"
        title="Product roadmap"
        lead={PRIMARY_WEDGE.summary}
      />

      <section className="marketing-section mkt-content-section">
        <LandingContainer>
          <ScrollReveal className="mkt-section-header">
            <span className="mkt-eyebrow">Quality</span>
            <h2>Agent quality metrics</h2>
            <p>Published results from our SWE-bench-style regression harness — run in CI on every quality gate.</p>
          </ScrollReveal>

          <ScrollReveal delayClass="landing-reveal-delay-1">
            <div className="quality-metrics-grid">
              {quality ? (
                <>
                  <article className="quality-metric-card landing-glass landing-glow-border">
                    <p className="quality-metric-label">Latest pass rate</p>
                    <p className="quality-metric-value">{quality.latest_pass_rate_pct}%</p>
                    <p className="quality-metric-detail">
                      {quality.passed_cases ?? quality.total_cases}/{quality.total_cases} fixture tasks
                    </p>
                  </article>
                  <article className="quality-metric-card landing-glass landing-glow-border">
                    <p className="quality-metric-label">Baseline</p>
                    <p className="quality-metric-value">{quality.baseline_pass_rate_pct}%</p>
                    <p className="quality-metric-detail">
                      {quality.has_baseline ? "Stored regression baseline" : "Default until first CI run"}
                    </p>
                  </article>
                  <article className="quality-metric-card landing-glass landing-glow-border">
                    <p className="quality-metric-label">Fixture suite</p>
                    <p className="quality-metric-value">{quality.total_cases}</p>
                    <p className="quality-metric-detail">Python patch + pytest tasks</p>
                  </article>
                  <article className="quality-metric-card landing-glass landing-glow-border">
                    <p className="quality-metric-label">Regression status</p>
                    <p className={`quality-metric-value ${quality.regression_alert ? "quality-metric-warn" : "quality-metric-ok"}`}>
                      {quality.regression_alert ? "Alert" : "OK"}
                    </p>
                    <p className="quality-metric-detail">
                      {quality.latest_run_at
                        ? `Last run ${new Date(quality.latest_run_at).toLocaleDateString()}`
                        : "Run via Settings → Analytics or CI"}
                    </p>
                  </article>
                </>
              ) : qualityError ? (
                <p className="small muted">Quality metrics unavailable — API may be offline.</p>
              ) : (
                <p className="small muted">Loading quality metrics…</p>
              )}
            </div>
            {quality?.description ? <p className="quality-metrics-note small">{quality.description}</p> : null}
          </ScrollReveal>

          <ScrollReveal className="mkt-section-header">
            <span className="mkt-eyebrow">Transparency</span>
            <h2>What we&apos;re building</h2>
            <p>
              Shipped items are live in the product today. In-progress work is actively being built. Planned items are
              prioritized but not yet scheduled with dates.
            </p>
          </ScrollReveal>

          <div className="roadmap-phases">
            {ROADMAP_PHASES.map((phase, index) => (
              <ScrollReveal key={phase.id} delayClass={`landing-reveal-delay-${Math.min(index + 1, 5)}`}>
                <article className="roadmap-phase-card landing-glass landing-glow-border">
                  <header className="roadmap-phase-header">
                    <div>
                      <h3>{phase.title}</h3>
                      <p className="roadmap-phase-time">{phase.timeframe}</p>
                    </div>
                    <StatusBadge status={phase.status} />
                  </header>
                  <p className="roadmap-phase-goal">{phase.goal}</p>
                  <ul className="roadmap-phase-items">
                    {phase.items.map((item) => (
                      <li key={item.label}>
                        <StatusBadge status={item.status} />
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </ScrollReveal>
            ))}
          </div>

          <p className="roadmap-footer-note">
            For engineering phase tickets see <code>docs/implementation-plan.md</code>. Product strategy lives in{" "}
            <code>docs/product-roadmap.md</code> in the repository.
          </p>

          <div className="roadmap-cta-row mkt-cta-row">
            <Link href="/editor" className="landing-btn landing-btn-primary mkt-btn-primary">
              Open editor
            </Link>
            <Link href="/pricing" className="landing-btn landing-btn-secondary mkt-btn-secondary">
              View pricing
            </Link>
          </div>
        </LandingContainer>
      </section>
    </MarketingShell>
  );
}
