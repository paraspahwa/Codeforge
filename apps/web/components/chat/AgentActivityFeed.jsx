"use client";

import ProposalReview from "./ProposalReview";

export default function AgentActivityFeed({ agentEvents, pendingProposal }) {
  return (
    <section className="agent-activity">
      <ProposalReview pendingProposal={pendingProposal} />
      {agentEvents.length > 0 ? (
        <div className="agent-activity-log">
          {agentEvents.map((line, index) => (
            <p className="small" key={`${line}-${index}`}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
