"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const METRICS = [
  { value: "30+", label: "Agent patterns" },
  { value: "INR", label: "Razorpay billing" },
  { value: "Web", label: "Browser-first IDE" },
  { value: "MCP", label: "Tool integrations" },
];

const LOGOS = [
  "Indie Founders",
  "Startup India",
  "Dev Studios",
  "Product Teams",
  "SaaS Builders",
  "Agencies",
  "Bootstrappers",
  "Engineering Leads",
];

export default function LandingTrustStrip() {
  const marqueeItems = [...LOGOS, ...LOGOS];

  return (
    <section className="landing-trust landing-section-block">
      <LandingContainer>
        <ScrollReveal>
          <p className="landing-trust-label">Built for teams shipping real products</p>
          <div className="landing-trust-metrics">
            {METRICS.map((metric) => (
              <div key={metric.label} className="landing-trust-metric">
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </LandingContainer>

      <div className="landing-marquee-wrap" aria-hidden="true">
        <div className="landing-marquee">
          {marqueeItems.map((name, index) => (
            <span key={`${name}-${index}`} className="landing-marquee-item">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
