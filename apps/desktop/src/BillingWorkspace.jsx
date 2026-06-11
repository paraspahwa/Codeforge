import { useEffect, useState } from "react";
import { EmptyState } from "@codeforge/ui";

import { API_BASE_URL, getBillingContext, getBillingSubscription, getUsageSummary, listBillingPlans } from "./api";
import { useDesktopAuth } from "./DesktopAuthContext";
import { useDesktopNotify } from "./useDesktopNotify";

const WEB_BASE = import.meta.env.VITE_CODEFORGE_WEB_BASE_URL || "http://localhost:3000";

function formatPlanSource(source) {
  if (source === "organization") {
    return "organization membership";
  }
  if (source === "subscription") {
    return "personal subscription";
  }
  return "free tier";
}

export default function BillingWorkspace() {
  const { userId, token } = useDesktopAuth();
  const { statusMessage, errorMessage, reportError, reportSuccess } = useDesktopNotify();

  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [billingContext, setBillingContext] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listBillingPlans()
      .then(setPlans)
      .catch((error) => reportError(error.message));
  }, [reportError]);

  useEffect(() => {
    if (!token) {
      return;
    }
    refreshBillingState().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refreshBillingState() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const [nextSubscription, nextUsage, nextContext] = await Promise.all([
        getBillingSubscription(token),
        getUsageSummary(token),
        getBillingContext(token),
      ]);
      setSubscription(nextSubscription);
      setUsage(nextUsage);
      setBillingContext(nextContext);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function openWebBilling() {
    const url = `${WEB_BASE.replace(/\/+$/, "")}/billing`;
    window.open(url, "_blank", "noopener,noreferrer");
    reportSuccess("Opened web billing in your browser (Razorpay checkout runs there)");
  }

  return (
    <main className="desktop-main">
      <h1>Billing</h1>
      <p className="muted">
        View plans and subscription state on desktop. Checkout uses Razorpay in the web app ({WEB_BASE}/billing).
      </p>
      {statusMessage ? <div className="status success">{statusMessage}</div> : null}
      {errorMessage ? <div className="status error">{errorMessage}</div> : null}

      <section className="card">
        <h2>Current plan</h2>
        {!token ? (
          <EmptyState title="Sign in required" description="Billing state requires authentication." />
        ) : usage ? (
          <div className="preview-box">
            <p>
              <strong>{usage.plan_id || "free"}</strong> via {formatPlanSource(usage.plan_source)}
            </p>
            <p>
              Requests: {usage.requests_used_in_period ?? usage.total_requests} / {usage.request_limit} (
              {usage.requests_remaining} left)
            </p>
            {subscription?.status ? <p>Subscription status: {subscription.status}</p> : null}
            {subscription?.current_period_end ? (
              <p className="muted small">Renews: {new Date(subscription.current_period_end).toLocaleString()}</p>
            ) : null}
          </div>
        ) : (
          <p className="muted">Loading…</p>
        )}
        <div className="button-row mt-6">
          <button type="button" onClick={refreshBillingState} disabled={!token || loading}>
            Refresh
          </button>
          <button type="button" onClick={openWebBilling} disabled={!token}>
            Upgrade in browser
          </button>
        </div>
      </section>

      {billingContext?.organizations?.length ? (
        <section className="card">
          <h2>Organizations</h2>
          {billingContext.organizations.map((org) => (
            <div className="session-row" key={org.org_id}>
              <strong>{org.name}</strong>
              <div className="muted small">
                {org.plan_id} · role: {org.role}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card">
        <h2>Available plans</h2>
        {plans.length === 0 ? (
          <EmptyState title="No plans loaded" description={`Check API at ${API_BASE_URL}`} />
        ) : (
          plans.map((plan) => (
            <div className="session-row" key={plan.plan_id}>
              <strong>{plan.name || plan.plan_id}</strong>
              <div className="muted small">
                {plan.currency || "INR"} {plan.amount_inr ?? plan.price_inr ?? "—"} / {plan.interval || "month"}
              </div>
              <div className="muted small">{plan.description}</div>
              <div className="muted small">Request limit: {plan.request_limit ?? "—"}</div>
            </div>
          ))
        )}
        <p className="muted small mt-6">Signed in as {userId}. Razorpay payment flow opens in the web app.</p>
      </section>
    </main>
  );
}
