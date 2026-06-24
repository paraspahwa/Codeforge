"use client";

import Link from "next/link";

import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingShell from "../../components/marketing/MarketingShell";
import { ScrollReveal } from "../../components/marketing/useScrollReveal";

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="landing-page-hero-band">
        <LandingContainer>
          <ScrollReveal>
            <h1>About CodeForge</h1>
            <p className="landing-hero-lead">
              Built for builders in India and beyond — an affordable, trustworthy AI coding assistant that helps you ship
              real products, not just snippets.
            </p>
          </ScrollReveal>
        </LandingContainer>
      </section>

      <LandingContainer>
        <article className="marketing-legal">
          <ScrollReveal delayClass="landing-reveal-delay-1">
            <section>
              <h2>Our mission</h2>
              <p>
                We believe everyone with an app idea deserves a capable AI partner — from first PRD to deployed code.
                CodeForge combines chat, specialized agents, MCP integrations, cowork automations, and a full IDE in one
                workspace.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal delayClass="landing-reveal-delay-2">
            <section>
              <h2>Built for India</h2>
              <p>
                INR pricing via Razorpay, sensible defaults for local builders, and infrastructure choices that keep costs
                low without sacrificing capability.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal delayClass="landing-reveal-delay-3">
            <section>
              <h2>Where we&apos;re headed</h2>
              <p>
                We publish an honest roadmap — what&apos;s shipped, in progress, and planned — so you know exactly what
                CodeForge is building and how we compare to tools like Cursor and Claude Code.
              </p>
              <Link href="/roadmap" className="landing-btn landing-btn-secondary marketing-about-cta">
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
              <Link href="/login?next=/app" className="landing-btn landing-btn-primary marketing-about-cta">
                Try CodeForge free
              </Link>
            </section>
          </ScrollReveal>
        </article>
      </LandingContainer>
    </MarketingShell>
  );
}
