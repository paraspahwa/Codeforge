"use client";

import Link from "next/link";

import LandingContainer from "./LandingContainer";
import LandingProductDemo from "./LandingProductDemo";

const TRUST = ["Monaco IDE", "Multi-file composer", "Loop Engineering", "Agent Reach"];

export default function LandingHero() {
  return (
    <section className="landing-hero mkt-hero">
      <LandingContainer wide>
        <div className="mkt-hero-copy">
          <p className="mkt-eyebrow">AI-native development platform</p>
          <h1 className="mkt-hero-title">
            Your coding agent for building ambitious software.
          </h1>
          <p className="mkt-hero-lead">
            CodeForge combines a VS Code–style web IDE, multi-file composer, and autonomous verify loops —
            so agents plan, edit, test, and ship in one workspace.
          </p>
          <div className="mkt-hero-actions">
            <Link href="/editor" className="landing-btn landing-btn-primary mkt-btn-primary">
              Open web editor
            </Link>
            <Link href="/login?next=/code" className="landing-btn landing-btn-secondary mkt-btn-secondary">
              Sign in for cloud workspace
            </Link>
          </div>
          <ul className="mkt-trust-row" aria-label="Platform highlights">
            {TRUST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="mkt-hero-visual">
          <LandingProductDemo />
        </div>
      </LandingContainer>
    </section>
  );
}
