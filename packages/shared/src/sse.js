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
    return `run:${payload.intent || "unknown"}:${payload.model || "unknown"}${proposalId}`;
  }

  if (event.type === "complete") {
    const proposalId = payload.proposal_id ? `:${payload.proposal_id}` : "";
    return `complete:${payload.output_tokens || payload.tokens || 0}${proposalId}`;
  }

  return event.type || "unknown event";
}