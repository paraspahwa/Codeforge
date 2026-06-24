"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import FeatureCatalog from "../../components/FeatureCatalog";
import { BUILD_JOURNEY, queueChatGoal } from "../../lib/product-features";

export default function FeaturesPage() {
  const router = useRouter();

  return (
    <div className="features-page">
      <header className="features-hero cf-animate-in">
        <p className="features-hero-kicker">
          <span className="cf-sparkle-inline" aria-hidden>✨</span>
          Everything CodeForge can do
        </p>
        <h1>Features &amp; agents</h1>
        <p className="features-hero-sub">
          Pick any capability below — no coding knowledge required. The AI explains each step and handles the technical work.
        </p>
        <Link href="/" className="features-hero-link cf-hover-lift">
          ← Back to chat
        </Link>
        <Link href="/agents" className="features-hero-link cf-hover-lift" style={{ marginLeft: "1rem" }}>
          Browse AI agents →
        </Link>
      </header>

      <section className="features-journey-banner cf-animate-in" style={{ animationDelay: "80ms" }}>
        <h2 className="small features-journey-title">Your build journey</h2>
        <div className="features-journey-pills">
          {BUILD_JOURNEY.map((step, index) => (
            <div
              key={step.step}
              className="journey-pill cf-animate-in cf-hover-lift"
              style={{ animationDelay: `${120 + index * 50}ms`, "--pill-color": step.color }}
            >
              <span aria-hidden>{step.icon}</span>
              <span>{step.title}</span>
            </div>
          ))}
        </div>
      </section>

      <FeatureCatalog
        variant="page"
        onStartGoal={(feature) => {
          queueChatGoal({ prompt: feature.starterPrompt, planMode: feature.planMode });
          router.push("/app");
        }}
      />
    </div>
  );
}
