"use client";

import Link from "next/link";

const CHECK_LABELS = {
  database_url: "Database configured",
  task_queue_backend: "Background jobs (Redis/Celery)",
  oidc_issuer: "SSO issuer configured",
  oidc_client_id: "SSO client ID",
  oidc_client_secret: "SSO client secret",
  oidc_redirect_uri: "SSO redirect URL",
  public_web_base_url: "Public web URL",
  razorpay_key_id: "Razorpay payments",
  razorpay_key_secret: "Razorpay secret",
  supabase_jwt_secret: "Supabase auth",
  qdrant_url: "Vector memory (Qdrant)",
  dev_login_disabled_under_oidc: "Dev login disabled in production",
};

function labelForCheck(name) {
  return CHECK_LABELS[name] || name.replaceAll("_", " ");
}

export default function DeployChecklistPanel({
  visible,
  onDismiss,
  deployReadiness,
  sessionChecks = [],
  loading = false,
  embedded = false,
}) {
  if (!visible) {
    return null;
  }

  const platformChecks = deployReadiness?.checks || [];
  const requiredFailed = platformChecks.filter((check) => check.required && !check.ok);
  const ready = deployReadiness?.ready ?? false;

  const content = (
    <>
      {!embedded ? (
        <header className="chat-post-run-header">
          <div>
            <h3>Deploy checklist</h3>
            <p className="small">Review before shipping to production.</p>
          </div>
          <button type="button" className="ghost-btn small" onClick={onDismiss}>
            Dismiss
          </button>
        </header>
      ) : (
        <header className="cf-context-section-header">
          <h3>Deploy checklist</h3>
          <p className="small">Review before shipping to production.</p>
        </header>
      )}

      {sessionChecks.length > 0 ? (
        <div className="deploy-checklist-section">
          <h4 className="small">This session</h4>
          <ul className="deploy-checklist-list">
            {sessionChecks.map((item) => (
              <li key={item.id} className={item.ok ? "deploy-check-ok" : "deploy-check-pending"}>
                <span aria-hidden="true">{item.ok ? "✓" : "○"}</span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="deploy-checklist-section">
        <h4 className="small">
          Platform readiness{" "}
          {loading ? (
            <span className="muted">(checking…)</span>
          ) : (
            <span className={ready ? "deploy-check-ok" : "deploy-check-warn"}>
              {ready ? "· ready" : "· needs attention"}
            </span>
          )}
        </h4>
        {loading ? (
          <p className="small muted">Loading environment checks…</p>
        ) : platformChecks.length > 0 ? (
          <ul className="deploy-checklist-list">
            {platformChecks.map((check) => (
              <li key={check.name} className={check.ok ? "deploy-check-ok" : check.required ? "deploy-check-fail" : "deploy-check-pending"}>
                <span aria-hidden="true">{check.ok ? "✓" : check.required ? "✗" : "○"}</span>
                {labelForCheck(check.name)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Could not load platform checks. Open Settings → Deploy for details.</p>
        )}
      </div>

      {!loading && requiredFailed.length > 0 ? (
        <p className="small deploy-checklist-hint">
          Fix blocked items in Settings → Deploy, or see{" "}
          <code>docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md</code> in the repo.
        </p>
      ) : null}

      <div className="deploy-checklist-actions">
        <Link href="/settings" className="landing-btn landing-btn-secondary">
          Open deploy settings
        </Link>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="deploy-checklist-panel deploy-checklist-panel-embedded" aria-label="Deploy checklist">
        {content}
      </div>
    );
  }

  return (
    <section className="chat-post-run-panel deploy-checklist-panel landing-glass" aria-label="Deploy checklist">
      {content}
    </section>
  );
}
