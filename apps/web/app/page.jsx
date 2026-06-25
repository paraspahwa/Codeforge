"use client";

import LandingAgentDemo from "../components/marketing/LandingAgentDemo";
import LandingBenefits from "../components/marketing/LandingBenefits";
import LandingFaq from "../components/marketing/LandingFaq";
import LandingFeatures from "../components/marketing/LandingFeatures";
import LandingFinalCta from "../components/marketing/LandingFinalCta";
import LandingHero from "../components/marketing/LandingHero";
import LandingHowItWorks from "../components/marketing/LandingHowItWorks";
import LandingPricingSection from "../components/marketing/LandingPricingSection";
import LandingProof from "../components/marketing/LandingProof";
import MarketingShell from "../components/marketing/MarketingShell";

export default function LandingPage() {
  return (
    <MarketingShell variant="landing">
      <div className="landing-page">
        <LandingHero />
        <LandingProof />
        <LandingBenefits />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingAgentDemo />
        <LandingPricingSection />
        <LandingFaq />
        <LandingFinalCta />
      </div>
    </MarketingShell>
  );
}
