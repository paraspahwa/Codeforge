"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import LandingContainer from "./LandingContainer";
import PlanCards from "./PlanCards";
import { ScrollReveal } from "./useScrollReveal";
import { listBillingPlans } from "../../lib/api";

export default function LandingPricingTeaser() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listBillingPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="landing-pricing-teaser landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Pricing</span>
          <h2>Simple, transparent pricing</h2>
          <p>Start free. Upgrade when you need more. All plans in INR via Razorpay.</p>
        </ScrollReveal>

        <ScrollReveal delayClass="landing-reveal-delay-1">
          <PlanCards plans={plans.slice(0, 3)} loading={loading} />
          <p className="small marketing-pricing-note">
            <Link href="/pricing">View all plans →</Link>
          </p>
        </ScrollReveal>
      </LandingContainer>
    </section>
  );
}
