"use client";

import { useState } from "react";

export default function ProposalReview({ pendingProposal, onDecision, loading = false }) {
  const [expanded, setExpanded] = useState(false);

  if (!pendingProposal) {
    return null;
  }

  const isApplied = pendingProposal.status === "approved" || pendingProposal.auto_applied;
  const isPending = pendingProposal.status === "pending" && !pendingProposal.auto_applied;
  const lines = String(pendingProposal.patch_preview || "").split("\n");
  const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;

  return (
    <div className={`proposal-card ${isApplied ? "proposal-card-applied" : ""}`}>
      <div className="proposal-diff-header">
        <div className="proposal-diff-title">
          <strong>{pendingProposal.target_file || "unknown file"}</strong>
          {isApplied ? <span className="proposal-applied-badge">✓ Applied automatically</span> : null}
        </div>
        <button
          type="button"
          className="proposal-toggle small"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Hide diff" : "View diff"}
        </button>
      </div>
      <div className="proposal-diff-stats small">
        <span className="diff-stat-add">+{added}</span>
        <span className="diff-stat-remove">-{removed}</span>
      </div>
      {expanded ? <pre className="proposal-preview diff-unified">{pendingProposal.patch_preview}</pre> : null}
      {isPending && onDecision ? (
        <div className="proposal-actions">
          <button type="button" onClick={() => onDecision("approve")} disabled={loading}>
            Approve
          </button>
          <button type="button" className="ghost-btn" onClick={() => onDecision("reject")} disabled={loading}>
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}
