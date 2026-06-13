export const AGENT_CATEGORIES = [
  { id: "foundational", title: "Foundational logic", subtitle: "Reflex, goals, utility, learning", emoji: "🧠" },
  { id: "design_pattern", title: "Single-agent patterns", subtitle: "ReAct, reflection, planning", emoji: "🔄" },
  { id: "multi_agent", title: "Multi-agent orchestration", subtitle: "Supervisor, pipeline, parallel, swarm", emoji: "👥" },
  { id: "human_integration", title: "Human-agent integration", subtitle: "HITL approvals and critic debate", emoji: "🤝" },
  { id: "industry", title: "Industry & enterprise", subtitle: "Sales, support, SecOps, compliance", emoji: "🏬" },
  { id: "infrastructure", title: "Infrastructure", subtitle: "Edge, cloud sandbox, browser RPA", emoji: "⚙️" },
  { id: "lifecycle", title: "Memory & lifecycle", subtitle: "Ephemeral vs persistent agents", emoji: "🕐" },
  { id: "operational", title: "CodeForge operations", subtitle: "Chat, tools, coding, Hermes", emoji: "🛠️" },
];

export const DEFAULT_AGENT_TYPE = "conversational";

export const PENDING_AGENT_STORAGE_KEY = "codeforge_pending_agent";

export const COMPLEXITY_LABELS = {
  low: "Low complexity",
  medium: "Medium complexity",
  high: "High complexity",
  critical: "Critical — human approval",
};

export function queueAgentSelection(agentType) {
  if (typeof window === "undefined" || !agentType) {
    return;
  }
  window.sessionStorage.setItem(PENDING_AGENT_STORAGE_KEY, agentType);
}

export function consumePendingAgentSelection() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.sessionStorage.getItem(PENDING_AGENT_STORAGE_KEY);
  if (!value) {
    return null;
  }
  window.sessionStorage.removeItem(PENDING_AGENT_STORAGE_KEY);
  return value;
}
