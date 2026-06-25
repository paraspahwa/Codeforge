"use client";

import { useEffect, useState } from "react";

import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingPageHeader from "../../components/marketing/MarketingPageHeader";
import MarketingShell from "../../components/marketing/MarketingShell";
import PlanCards from "../../components/marketing/PlanCards";
import { ScrollReveal } from "../../components/marketing/useScrollReveal";
import { listBillingPlans } from "../../lib/api";

export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listBillingPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Pricing"
        title="Simple, transparent plans"
        lead="Start free. Upgrade when you need more requests. All plans billed in INR via Razorpay."
      />

      <section className="marketing-section mkt-pricing-section">
        <LandingContainer>
          <ScrollReveal delayClass="landing-reveal-delay-1">
            <PlanCards plans={plans} loading={loading} />
            <p className="small marketing-pricing-note mkt-pricing-note">
              Need a team plan?{" "}
              <a href="/login?next=/team">Sign in</a> and manage organization billing from the Team page.
            </p>
          </ScrollReveal>
        </LandingContainer>
      </section>
    </MarketingShell>
  );
}
