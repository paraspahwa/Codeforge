"use client";

import Link from "next/link";

import IdeShell from "../../components/ide/IdeShell";
import { useCodeWorkspace } from "../../lib/use-code-workspace";

export default function CodeWorkspacePage() {
  const ws = useCodeWorkspace();

  if (ws.ready && !ws.token) {
    return (
      <section className="panel ide-signin-panel">
        <h2>Code editor</h2>
        <p className="small">Sign in to open the Monaco IDE workspace.</p>
        <Link href="/login?next=/code">Sign in</Link>
      </section>
    );
  }

  return <IdeShell ws={ws} />;
}
