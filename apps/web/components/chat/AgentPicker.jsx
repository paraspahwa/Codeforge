"use client";

import { DEFAULT_AGENT_TYPE } from "../../lib/agent-catalog";

export default function AgentPicker({ agents, selectedAgent, onSelectAgent, loading }) {
  const current = agents.find((agent) => agent.id === selectedAgent) || null;

  return (
    <div className="agent-picker cf-animate-in">
      <label className="small" htmlFor="agentType">
        Active agent
      </label>
      <select
        id="agentType"
        className="agent-input agent-picker-select"
        value={selectedAgent || DEFAULT_AGENT_TYPE}
        onChange={(event) => onSelectAgent(event.target.value)}
        disabled={loading}
      >
        {agents.length === 0 ? (
          <option value={DEFAULT_AGENT_TYPE}>Conversational Agent</option>
        ) : (
          agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.icon} {agent.name}
            </option>
          ))
        )}
      </select>
      {current ? (
        <p className="small agent-picker-hint">
          {current.tagline} — <a href="/agents">Browse all agents</a>
        </p>
      ) : (
        <p className="small agent-picker-hint">
          <a href="/agents">Browse all agents</a>
        </p>
      )}
    </div>
  );
}
