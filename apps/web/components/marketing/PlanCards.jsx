"use client";

import Link from "next/link";

export default function PlanCards({ plans, loading, showCheckoutHint = true }) {
  if (loading) {
    return <p className="small">Loading plans…</p>;
  }

  if (!plans?.length) {
    return (
      <p className="small">
        Plans are loading from the API.{" "}
        <Link href="/login?next=/billing">Sign in</Link> to manage billing.
      </p>
    );
  }

  return (
    <div className="marketing-plan-grid">
      {plans.map((plan) => (
        <article
          key={plan.plan_id}
          className={`marketing-plan-card landing-glass landing-glow-border ${plan.plan_id === "pro" ? "marketing-plan-featured" : ""}`}
        >
          <h3>{plan.name}</h3>
          <p className="marketing-plan-price">
            {plan.amount_inr > 0 ? (
              <>
                ₹{plan.amount_inr}
                <span className="small">/mo</span>
              </>
            ) : (
              "Free"
            )}
          </p>
          <p className="small">{plan.request_limit} requests / month</p>
          {plan.description ? <p className="small marketing-plan-desc">{plan.description}</p> : null}
          {showCheckoutHint ? (
            <Link
              href={`/login?next=${encodeURIComponent("/billing")}`}
              className="landing-btn landing-btn-primary marketing-plan-cta"
            >
              {plan.amount_inr > 0 ? "Subscribe" : "Get started"}
            </Link>
          ) : null}
        </article>
      ))}
    </div>
  );
}
