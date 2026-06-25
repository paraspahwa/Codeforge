"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import FeatureCatalog from "../../components/FeatureCatalog";
import MarketingPageHeader from "../../components/marketing/MarketingPageHeader";
import MarketingShell from "../../components/marketing/MarketingShell";
import LandingContainer from "../../components/marketing/LandingContainer";
import { BUILD_JOURNEY, queueChatGoal } from "../../lib/product-features";

export default function FeaturesPage() {
  const router = useRouter();

  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Capabilities"
        title="Features & workflows"
        lead="Every major CodeForge surface — chat, IDE, agents, MCP, cowork, and billing — in one catalog. Pick a goal and start in /app."
      >
        <div className="mkt-page-links">
          <Link href="/agents">Browse agents →</Link>
          <Link href="/editor">Open editor →</Link>
        </div>
      </MarketingPageHeader>

      <LandingContainer>
        <section className="mkt-content-section">
          <h2 className="mkt-content-subtitle">Your build journey</h2>
          <div className="mkt-journey-pills">
            {BUILD_JOURNEY.map((step) => (
              <div key={step.step} className="mkt-journey-pill" style={{ "--pill-color": step.color }}>
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
      </LandingContainer>
    </MarketingShell>
  );
}
