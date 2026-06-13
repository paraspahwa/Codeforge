"use client";

import Link from "next/link";

export default function TitleBar({
  workspaceName,
  remoteLabel,
  globalSearch,
  onGlobalSearchChange,
  onOpenQuickOpen,
  usage,
}) {
  return (
    <header className="ide-title-bar">
      <div className="ide-title-left">
        <Link href="/" className="ide-title-home" title="Back to CodeForge">
          CodeForge
        </Link>
        <span className="ide-title-sep">›</span>
        <span className="ide-title-workspace">{workspaceName || "Untitled workspace"}</span>
        {remoteLabel ? <span className="ide-title-remote">{remoteLabel}</span> : null}
      </div>
      <div className="ide-title-center">
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
          placeholder="Search — Ctrl+P quick open"
          aria-label="Global search"
        />
      </div>
      <div className="ide-title-right">
        {usage ? <span className="ide-title-usage">{usage.requests_remaining ?? 0} req left</span> : null}
      </div>
    </header>
  );
}
