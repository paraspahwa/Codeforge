"use client";

import { useEffect, useState } from "react";

import LandingContainer from "../../components/marketing/LandingContainer";
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
      <section className="landing-page-hero-band">
        <LandingContainer>
          <ScrollReveal>
            <h1>Simple, transparent pricing</h1>
            <p className="landing-hero-lead">
              Start free. Upgrade when you need more requests. All plans billed in INR via Razorpay.
            </p>
          </ScrollReveal>
        </LandingContainer>
      </section>
      <section className="marketing-section landing-pricing-teaser">
        <LandingContainer>
          <ScrollReveal delayClass="landing-reveal-delay-1">
            <PlanCards plans={plans} loading={loading} />
            <p className="small marketing-pricing-note">
              Need a team plan?{" "}
              <a href="/login?next=/team">Sign in</a> and manage organization billing from the Team page.
            </p>
          </ScrollReveal>
        </LandingContainer>
      </section>
    </MarketingShell>
  );
}
