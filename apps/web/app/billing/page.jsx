"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBillingOrder,
  getBillingContext,
  getBillingSubscription,
  getUsageSummary,
  listBillingPlans,
  verifyBillingPayment,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

function formatPlanSource(source) {
  if (source === "organization") {
    return "organization membership";
  }
  if (source === "subscription") {
    return "personal subscription";
  }
  return "free tier";
}

export default function BillingPage() {
  const { userId, token, ready } = useAuth();
  const toast = useToast();

  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [billingContext, setBillingContext] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [upgradeOrgId, setUpgradeOrgId] = useState("");

  const manageableOrgs = (billingContext?.organizations || []).filter(
    (org) => org.role === "owner" || org.role === "admin",
  );

  async function refreshBillingState(activeToken) {
    const [nextSubscription, nextUsage, nextContext] = await Promise.all([
      getBillingSubscription(activeToken),
      getUsageSummary(activeToken),
      getBillingContext(activeToken),
    ]);
    setSubscription(nextSubscription);
    setUsage(nextUsage);
    setBillingContext(nextContext);
  }

  useEffect(() => {
    listBillingPlans()
      .then(setPlans)
      .catch((error) => toast.push(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    refreshBillingState(token).catch(() => undefined);
  }, [ready, token]);

  useEffect(() => {
    if (!upgradeOrgId && manageableOrgs.length) {
      setUpgradeOrgId(manageableOrgs[0].org_id);
    }
  }, [manageableOrgs, upgradeOrgId]);

  async function handleCheckout(plan) {
    setLoading(true);
    try {
      const order = await createBillingOrder(token, {
        plan_id: plan.plan_id,
        amount_inr: plan.amount_inr,
        currency: "INR",
        org_id: upgradeOrgId || null,
      });
      await loadRazorpayScript();

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable");
      }

      const checkout = new window.Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        currency: order.currency,
        amount: plan.amount_inr * 100,
        name: "CodeForge",
        description: `${plan.name} subscription`,
        handler: async (response) => {
          try {
            const verified = await verifyBillingPayment(token, {
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              plan_id: plan.plan_id,
              amount_inr: plan.amount_inr,
              org_id: upgradeOrgId || null,
            });
            await refreshBillingState(token);
            if (verified.org_plan_updated) {
              toast.push(`Subscribed to ${plan.name} and upgraded organization to ${verified.organization_plan_id}`, "success");
            } else {
              toast.push(`Subscribed to ${plan.name}`, "success");
            }
          } catch (error) {
            toast.push(error.message);
          }
        },
        prefill: {
          name: userId,
          email: `${userId}@codeforge.local`,
        },
        theme: {
          color: "#2563eb",
        },
      });

      checkout.open();
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  const effectivePlanId = billingContext?.effective_plan_id || subscription?.plan_id || "free";
  const effectiveSource = billingContext?.effective_source || "free";

  return (
    <div className="stack">
      {billingContext ? (
        <section className="panel subscription-banner">
          <strong>Effective plan:</strong> {effectivePlanId} via {formatPlanSource(effectiveSource)}
          <span className="small">
            {" "}
            | {billingContext.requests_used_in_period} used, {billingContext.requests_remaining} of{" "}
            {billingContext.request_limit} remaining this month
          </span>
          {billingContext.subscription_plan_id !== billingContext.effective_plan_id ? (
            <p className="small mt-8">
              Personal subscription: {billingContext.subscription_plan_id} ({billingContext.subscription_status})
              {billingContext.organization_plan_id
                ? ` · Organization plan: ${billingContext.organization_plan_id}`
                : null}
            </p>
          ) : null}
        </section>
      ) : subscription ? (
        <section className="panel subscription-banner">
          <strong>Current plan:</strong> {subscription.plan_id} ({subscription.status})
          {usage ? (
            <span className="small">
              {" "}
              | {usage.requests_used_in_period ?? usage.total_requests} used, {usage.requests_remaining} of{" "}
              {usage.request_limit} remaining this month
            </span>
          ) : null}
        </section>
      ) : null}

      {billingContext?.organizations?.length ? (
        <section className="panel">
          <h2>Organization plans</h2>
          <p className="small">
            Org membership can raise your effective request limit above a personal subscription. Manage orgs on the{" "}
            <Link href="/team">Team</Link> page.
          </p>
          <ul className="small">
            {billingContext.organizations.map((org) => (
              <li key={org.org_id}>
                <strong>{org.name}</strong> · {org.plan_id} plan · your role: {org.role}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <h2>Plans</h2>
        <p className="small">Razorpay-first billing with INR pricing and UPI support.</p>
        {manageableOrgs.length ? (
          <>
            <label className="small" htmlFor="upgradeOrgId">
              Apply subscription to organization (optional)
            </label>
            <select id="upgradeOrgId" value={upgradeOrgId} onChange={(event) => setUpgradeOrgId(event.target.value)}>
              <option value="">Personal subscription only</option>
              {manageableOrgs.map((org) => (
                <option key={org.org_id} value={org.org_id}>
                  {org.name} ({org.plan_id})
                </option>
              ))}
            </select>
          </>
        ) : null}
        <div className="plan-list mt-8">
          {plans.length === 0 ? <p className="small">Loading plans...</p> : null}
          {plans.map((plan) => {
            const isEffective = effectivePlanId === plan.plan_id;
            const isPersonalActive = subscription?.plan_id === plan.plan_id;
            return (
              <div className="plan-row" key={plan.plan_id}>
                <div>
                  <strong>{plan.name}</strong>
                  <div className="small">
                    INR {plan.amount_inr} • {plan.request_limit} requests/month
                  </div>
                  {isEffective ? (
                    <div className="small">Currently applied to your account ({formatPlanSource(effectiveSource)})</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleCheckout(plan)}
                  disabled={!token || loading || isPersonalActive}
                >
                  {isPersonalActive ? "Subscribed" : isEffective && effectiveSource === "organization" ? "Org plan active" : "Subscribe"}
                </button>
              </div>
            );
          })}
        </div>
        {!token && ready ? <p className="small mt-8">Login from the top bar to subscribe.</p> : null}
      </section>
    </div>
  );
}
