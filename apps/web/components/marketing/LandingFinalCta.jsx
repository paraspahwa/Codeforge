"use client";

import Link from "next/link";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

export default function LandingFinalCta() {
  return (
    <section className="landing-final-cta-wrap mkt-final-cta-wrap">
      <LandingContainer>
        <div className="landing-final-cta mkt-final-cta">
          <ScrollReveal>
            <h2>Start building with agents today.</h2>
            <p>Open the editor locally or sign in for cloud sessions, git, and team features.</p>
            <div className="mkt-hero-actions mkt-hero-actions--center">
              <Link href="/editor" className="landing-btn landing-btn-primary mkt-btn-primary">
                Open web editor
              </Link>
              <Link href="/login?next=/code" className="landing-btn landing-btn-secondary mkt-btn-secondary">
                Sign in
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </LandingContainer>
    </section>
  );
}
