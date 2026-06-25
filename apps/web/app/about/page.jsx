"use client";

import Link from "next/link";

import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingPageHeader from "../../components/marketing/MarketingPageHeader";
import MarketingShell from "../../components/marketing/MarketingShell";
import { ScrollReveal } from "../../components/marketing/useScrollReveal";

export default function AboutPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Company"
        title="About CodeForge"
        lead="An India-first AI coding platform — Monaco IDE, agent composer, MCP research, and verify loops in one product."
      />

      <LandingContainer>
        <article className="marketing-legal mkt-prose">
          <ScrollReveal delayClass="landing-reveal-delay-1">
            <section>
              <h2>Our mission</h2>
              <p>
                Everyone with an app idea deserves a capable AI partner — from first PRD to deployed code. CodeForge
                combines chat, specialized agents, MCP integrations, cowork automations, and a full IDE in one workspace.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal delayClass="landing-reveal-delay-2">
            <section>
              <h2>Built for India</h2>
              <p>
                INR pricing via Razorpay, sensible defaults for local builders, and infrastructure choices that keep
                costs low without sacrificing capability.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal delayClass="landing-reveal-delay-3">
            <section>
              <h2>Where we&apos;re headed</h2>
              <p>
                We publish an honest roadmap — what&apos;s shipped, in progress, and planned — so you know exactly what
                CodeForge is building.
              </p>
              <Link href="/roadmap" className="landing-btn landing-btn-secondary mkt-btn-secondary">
                View the roadmap
              </Link>
            </section>
          </ScrollReveal>

          <ScrollReveal delayClass="landing-reveal-delay-4">
            <section>
              <h2>Get in touch</h2>
              <p>
                Questions, partnerships, or enterprise SSO:{" "}
                <a href="mailto:hello@codeforge.app">hello@codeforge.app</a>
              </p>
              <Link href="/editor" className="landing-btn landing-btn-primary mkt-btn-primary">
                Try the editor
              </Link>
            </section>
          </ScrollReveal>
        </article>
      </LandingContainer>
    </MarketingShell>
  );
}
