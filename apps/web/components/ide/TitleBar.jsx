"use client";

import Link from "next/link";

import { Icon } from "@codeforge/ui";

import { buildSessionPath } from "../../lib/session-route";

export default function TitleBar({
  workspaceName,
  remoteLabel,
  globalSearch,
  onGlobalSearchChange,
  onOpenQuickOpen,
  usage,
  onRun,
  sessionId,
}) {
  const shortSession =
    sessionId && sessionId.length > 12 ? `${sessionId.slice(0, 12)}…` : sessionId;

  return (
    <header className="ide-title-bar">
      <div className="ide-title-left">
        <Link href="/app" className="ide-title-home" title="Back to chat">
          CodeForge
        </Link>
        <span className="ide-title-sep" aria-hidden="true">
          /
        </span>
        <span className="ide-title-workspace">{workspaceName || "Workspace"}</span>
        {remoteLabel ? <span className="ide-title-remote">{remoteLabel}</span> : null}
      </div>
      <div className="ide-title-center">
        <div className="ide-title-search-wrap">
          <Icon name="Search" size={14} className="ide-title-search-icon" />
          <input
            className="ide-title-search"
            value={globalSearch}
            onChange={(event) => onGlobalSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
                event.preventDefault();
                onOpenQuickOpen();
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                onOpenQuickOpen();
              }
            }}
            placeholder="Search files — Ctrl+P"
            aria-label="Global search"
          />
        </div>
      </div>
      <div className="ide-title-right">
        {sessionId ? (
          <Link
            href={buildSessionPath("/app", sessionId)}
            className="cf-status-pill cf-status-pill-subtle"
            title={sessionId}
          >
            Session {shortSession}
          </Link>
        ) : null}
        {onRun ? (
          <button type="button" className="cf-status-pill" onClick={onRun} title="Run (Ctrl+Shift+R)">
            Run
          </button>
        ) : null}
        {usage ? (
          <span className="ide-title-usage">{usage.requests_remaining ?? 0} left</span>
        ) : null}
        <Link href="/settings" className="ide-title-icon-link" title="Settings">
          <Icon name="Settings" size={16} />
        </Link>
      </div>
    </header>
  );
}
