"use client";

import Link from "next/link";

import LandingContainer from "./LandingContainer";
import LandingProductDemo from "./LandingProductDemo";

export default function LandingHero() {
  function scrollToDemo(event) {
    event.preventDefault();
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="landing-hero">
      <span className="landing-orb landing-orb--cyan" aria-hidden="true" />
      <span className="landing-orb landing-orb--indigo" aria-hidden="true" />

      <LandingContainer wide>
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow-pill">
              <span className="landing-eyebrow-dot" aria-hidden="true" />
              India-first AI product partner
            </p>
            <h1>
              Your AI partner for building <span className="landing-headline-gradient">ambitious software</span>
            </h1>
            <p className="landing-hero-lead">
              Go from idea to shipped product — chat, agents, code editor, and automations in one workspace. No coding
              experience required.
            </p>
            <div className="landing-hero-actions">
              <Link href="/login?next=/app" className="landing-btn landing-btn-primary">
                Start building free
              </Link>
              <a href="#demo" className="landing-btn landing-btn-secondary" onClick={scrollToDemo}>
                See it in action ↓
              </a>
            </div>
          </div>

          <LandingProductDemo />
        </div>
      </LandingContainer>
    </section>
  );
}
