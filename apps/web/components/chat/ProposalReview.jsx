"use client";

import { Button } from "@codeforge/ui";

import { useSessionAccess } from "../../lib/session-context";

export default function ProposalReview({ pendingProposal, loading, onDecision }) {
  const { sessionWritable } = useSessionAccess();
  if (!pendingProposal) {
    return null;
  }

  const lines = String(pendingProposal.patch_preview || "").split("\n");
  const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;

  return (
    <div className="proposal-card">
      <div className="proposal-diff-header">
        <strong>{pendingProposal.target_file || "unknown file"}</strong>
        <span className="small">
          {pendingProposal.proposal_id} · {pendingProposal.status}
        </span>
      </div>
      <div className="proposal-diff-stats small">
        <span className="diff-stat-add">+{added}</span>
        <span className="diff-stat-remove">-{removed}</span>
      </div>
      <pre className="proposal-preview diff-unified">{pendingProposal.patch_preview}</pre>
      {pendingProposal.status === "pending" ? (
        <div className="proposal-actions">
          <Button type="button" onClick={() => onDecision("approve")} disabled={loading || !sessionWritable}>
            Approve
          </Button>
          <Button type="button" variant="ghost" onClick={() => onDecision("reject")} disabled={loading}>
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}
