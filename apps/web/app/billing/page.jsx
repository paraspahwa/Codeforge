"use client";

import { useEffect, useState } from "react";

import {
  createBillingOrder,
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

export default function BillingPage() {
  const { userId, token, ready } = useAuth();
  const toast = useToast();

  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);

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
    getBillingSubscription(token)
      .then(setSubscription)
      .catch(() => undefined);
    getUsageSummary(token)
      .then(setUsage)
      .catch(() => undefined);
  }, [ready, token]);

  async function handleCheckout(plan) {
    setLoading(true);
    try {
      const order = await createBillingOrder(token, plan.plan_id, plan.amount_inr);
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
            await verifyBillingPayment(token, {
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              plan_id: plan.plan_id,
              amount_inr: plan.amount_inr,
            });
            const [nextSubscription, nextUsage] = await Promise.all([
              getBillingSubscription(token),
              getUsageSummary(token),
            ]);
            setSubscription(nextSubscription);
            setUsage(nextUsage);
            toast.push(`Subscribed to ${plan.name}`, "success");
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

  return (
    <div className="stack">
      {subscription ? (
        <section className="panel subscription-banner">
          <strong>Current plan:</strong> {subscription.plan_id} ({subscription.status})
          {usage ? (
            <span className="small">
              {" "}
              | {usage.requests_used_in_period ?? usage.total_requests} used, {usage.requests_remaining} of {usage.request_limit} remaining this month
            </span>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <h2>Plans</h2>
        <p className="small">Razorpay-first billing with INR pricing and UPI support.</p>
        <div className="plan-list mt-8">
          {plans.length === 0 ? <p className="small">Loading plans...</p> : null}
          {plans.map((plan) => (
            <div className="plan-row" key={plan.plan_id}>
              <div>
                <strong>{plan.name}</strong>
                <div className="small">
                  INR {plan.amount_inr} • {plan.request_limit} requests/month
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCheckout(plan)}
                disabled={!token || loading || subscription?.plan_id === plan.plan_id}
              >
                {subscription?.plan_id === plan.plan_id ? "Active" : "Subscribe"}
              </button>
            </div>
          ))}
        </div>
        {!token && ready ? <p className="small mt-8">Login from the top bar to subscribe.</p> : null}
      </section>
    </div>
  );
}
