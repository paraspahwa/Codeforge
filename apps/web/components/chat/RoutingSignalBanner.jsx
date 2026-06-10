"use client";

import { Banner } from "@codeforge/ui";

export default function RoutingSignalBanner({ signal }) {
  if (!signal) {
    return null;
  }

  const score = Math.round((signal.confidence_score ?? 0) * 100);
  const parts = [
    `Routed via ${signal.model_used || signal.model || "unknown"}`,
    signal.intent ? `intent: ${signal.intent}` : null,
    signal.confidence_label ? `confidence: ${signal.confidence_label} (${score}%)` : null,
    signal.routing_tier ? `tier: ${signal.routing_tier}` : null,
    signal.fallback_used ? "fallback path" : null,
  ].filter(Boolean);

  if (signal.review_required) {
    return <Banner variant="warning">{parts.join(" · ")} — human review recommended</Banner>;
  }

  return <Banner variant="info">{parts.join(" · ")}</Banner>;
}
