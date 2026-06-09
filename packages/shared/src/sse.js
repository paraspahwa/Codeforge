export function routingSignalFromPayload(payload = {}) {
  return {
    intent: payload.intent,
    model_used: payload.model || payload.model_used,
    confidence_score: payload.confidence_score,
    confidence_label: payload.confidence_label,
    review_required: Boolean(payload.review_required),
    routing_tier: payload.routing_tier,
    fallback_used: Boolean(payload.fallback_used),
  };
}

export function routingSignalFromMessageResponse(response = {}) {
  return {
    intent: response.intent,
    model_used: response.model_used,
    confidence_score: response.confidence_score,
    confidence_label: response.confidence_label,
    review_required: Boolean(response.review_required),
    routing_tier: response.routing_tier,
    fallback_used: Boolean(response.fallback_used),
  };
}

export function formatRoutingSignal(signal) {
  if (!signal) {
    return "Routing: awaiting prompt";
  }

  const confidence = `${signal.confidence_label || "unknown"} ${Math.round((signal.confidence_score || 0) * 100)}%`;
  const review = signal.review_required ? " · review required" : "";
  const tier = signal.routing_tier ? ` · tier ${signal.routing_tier}` : "";
  const fallback = signal.fallback_used ? " · fallback path" : "";
  return `Routing: ${signal.intent || "unknown"} via ${signal.model_used || "unknown"} · confidence ${confidence}${review}${tier}${fallback}`;
}

export function formatEvent(event) {
  if (!event || typeof event !== "object") {
    return "unknown event";
  }

  const payload = event.payload || {};

  const clip = (text, limit = 180) => {
    if (!text) {
      return "";
    }

    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  };

  if (event.type === "token") {
    return payload.content || event.content || "";
  }

  if (event.type === "tool_call") {
    return `tool:${payload.tool || "unknown"}:${payload.status || "pending"}`;
  }

  if (event.type === "diff") {
    return `diff:${payload.file || "unknown"}`;
  }

  if (event.type === "approval_request") {
    return `approval:${payload.scope || "unknown"}`;
  }

  if (event.type === "tool_result") {
    return `verify:${payload.status || "unknown"}`;
  }

  if (event.type === "shell_call") {
    return `shell:${clip(payload.command || "unknown", 120)}`;
  }

  if (event.type === "shell_output") {
    return `shell:${payload.stream || "stdout"}:${clip(payload.content || "")}`;
  }

  if (event.type === "shell_result") {
    return `shell:exit:${payload.exit_code ?? "unknown"}:${payload.output_lines ?? 0} lines`;
  }

  if (event.type === "run_started") {
    const proposalId = payload.proposal_id ? `:${payload.proposal_id}` : "";
    const confidence =
      payload.confidence_label && payload.confidence_score !== undefined
        ? ` | confidence ${payload.confidence_label} ${Math.round(Number(payload.confidence_score) * 100)}%`
        : "";
    const review = payload.review_required ? " | review required" : "";
    const tier = payload.routing_tier ? ` | tier ${payload.routing_tier}` : "";
    const fallback = payload.fallback_used ? " | fallback" : "";
    return `run:${payload.intent || "unknown"}:${payload.model || "unknown"}${proposalId}${confidence}${review}${tier}${fallback}`;
  }

  if (event.type === "complete") {
    const proposalId = payload.proposal_id ? `:${payload.proposal_id}` : "";
    const confidence =
      payload.confidence_label && payload.confidence_score !== undefined
        ? ` | confidence ${payload.confidence_label} ${Math.round(Number(payload.confidence_score) * 100)}%`
        : "";
    const review = payload.review_required ? " | review required" : "";
    return `complete:${payload.output_tokens || payload.tokens || 0}${proposalId}${confidence}${review}`;
  }

  return event.type || "unknown event";
}