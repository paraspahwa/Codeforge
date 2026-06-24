"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { buildSessionPath } from "../lib/session-route";

export default function SessionChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");

  if (!sessionId) {
    return null;
  }

  const shortId = sessionId.length > 12 ? `${sessionId.slice(0, 12)}…` : sessionId;
  const onApp = pathname === "/app" || pathname.startsWith("/app/");
  const onCode = pathname === "/code" || pathname.startsWith("/code/");

  const linkClass = "ghost-btn inline-btn session-chrome-link";

  return (
    <div className="session-chrome small">
      <span className="session-chrome-label" title={sessionId}>
        Session {shortId}
      </span>
      {onApp ? (
        <Link href={buildSessionPath("/code", sessionId)} className={linkClass}>
          Open in editor
        </Link>
      ) : null}
      {onCode ? (
        <Link href={buildSessionPath("/app", sessionId)} className={linkClass}>
          Back to chat
        </Link>
      ) : null}
      {!onApp && !onCode ? (
        <>
          <Link href={buildSessionPath("/app", sessionId)} className={linkClass}>
            Chat
          </Link>
          <Link href={buildSessionPath("/code", sessionId)} className={linkClass}>
            Editor
          </Link>
        </>
      ) : null}
    </div>
  );
}
