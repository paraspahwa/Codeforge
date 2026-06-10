"use client";

import ProposalReview from "./ProposalReview";

export default function AgentActivityFeed({ agentEvents, pendingProposal, onDecision, loading }) {
  return (
    <section className="panel">
      <h2>Agent Activity</h2>
      <ProposalReview pendingProposal={pendingProposal} loading={loading} onDecision={onDecision} />
      <div className="session-list">
        {agentEvents.length === 0 ? <p className="small">No agent events yet.</p> : null}
        {agentEvents.map((line, index) => (
          <p className="small" key={`${line}-${index}`}>
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
