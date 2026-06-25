"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { listBillingPlans } from "../../lib/api";
import LandingContainer from "./LandingContainer";
import PlanCards from "./PlanCards";
import { ScrollReveal } from "./useScrollReveal";

const FALLBACK_PLANS = [
  { plan_id: "lite", name: "Starter", amount_inr: 199, request_limit: 300, description: "Solo builders — chat, IDE, agent loops." },
  { plan_id: "pro", name: "Pro", amount_inr: 499, request_limit: 1000, description: "Teams shipping weekly — composer and cowork." },
  { plan_id: "team", name: "Enterprise", amount_inr: 1299, request_limit: 2500, description: "SSO, team workspaces, priority routing." },
];

export default function LandingPricingSection() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    listBillingPlans()
      .then((result) => setPlans(result?.length ? result : FALLBACK_PLANS))
      .catch(() => setPlans(FALLBACK_PLANS))
      .finally(() => setLoading(false));
  }, []);

  const displayPlans = useMemo(() => {
    const source = (plans.length ? plans : FALLBACK_PLANS).slice(0, 3);
    const labels = ["Starter", "Pro", "Enterprise"];
    return source.map((plan, index) => ({
      ...plan,
      name: labels[index] || plan.name,
      amount_inr: plan.amount_inr && yearly ? Math.round(plan.amount_inr * 10) : plan.amount_inr,
    }));
  }, [plans, yearly]);

  return (
    <section id="pricing" className="landing-pricing landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Pricing</span>
          <h2>Simple plans that scale with you</h2>
          <p>Start free. Upgrade when agents become your default workflow.</p>
        </ScrollReveal>

        <ScrollReveal delayClass="landing-reveal-delay-1">
          <div className="landing-pricing-toggle" role="group" aria-label="Billing period">
            <button
              type="button"
              className={!yearly ? "is-active" : ""}
              onClick={() => setYearly(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={yearly ? "is-active" : ""}
              onClick={() => setYearly(true)}
            >
              Yearly
              <span className="landing-pricing-save">Save ~17%</span>
            </button>
          </div>

          <PlanCards plans={displayPlans} loading={loading} yearly={yearly} />
          <p className="small landing-pricing-foot">
            <Link href="/pricing">Compare all features →</Link>
            <span> · </span>
            <a href="mailto:hello@codeforge.app">Talk to sales</a>
          </p>
        </ScrollReveal>
      </LandingContainer>
    </section>
  );
}
