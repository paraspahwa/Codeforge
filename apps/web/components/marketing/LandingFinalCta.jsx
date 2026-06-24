"use client";

import Link from "next/link";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

export default function LandingFinalCta() {
  return (
    <section className="landing-final-cta-wrap">
      <LandingContainer>
        <div className="landing-final-cta landing-glass landing-glow-border">
          <ScrollReveal>
            <h2>Try CodeForge now</h2>
            <p>Start building your next app — free to begin, ready for production when you are.</p>
            <Link href="/login?next=/app" className="landing-btn landing-btn-primary">
              Get started — it&apos;s free
            </Link>
          </ScrollReveal>
        </div>
      </LandingContainer>
    </section>
  );
}
