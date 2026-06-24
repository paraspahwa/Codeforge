"use client";

import LandingAgentDemo from "../components/marketing/LandingAgentDemo";
import LandingAudiences from "../components/marketing/LandingAudiences";
import LandingCompare from "../components/marketing/LandingCompare";
import LandingFeatures from "../components/marketing/LandingFeatures";
import LandingFinalCta from "../components/marketing/LandingFinalCta";
import LandingHero from "../components/marketing/LandingHero";
import LandingHowItWorks from "../components/marketing/LandingHowItWorks";
import LandingModelStrip from "../components/marketing/LandingModelStrip";
import LandingPricingTeaser from "../components/marketing/LandingPricingTeaser";
import LandingTestimonials from "../components/marketing/LandingTestimonials";
import LandingTrustStrip from "../components/marketing/LandingTrustStrip";
import MarketingShell from "../components/marketing/MarketingShell";

export default function LandingPage() {
  return (
    <MarketingShell variant="landing">
      <div className="landing-page">
        <LandingHero />
        <LandingAudiences />
        <LandingTrustStrip />
        <LandingAgentDemo />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingCompare />
        <LandingModelStrip />
        <LandingTestimonials />
        <LandingPricingTeaser />
        <LandingFinalCta />
      </div>
    </MarketingShell>
  );
}
