"use client";

import IdeShell from "../../components/ide/IdeShell";
import { useCodeWorkspace } from "../../lib/use-code-workspace";
import { useLocalIde } from "../../lib/use-local-ide";

function LocalIdeShell() {
  const ws = useLocalIde();
  return <IdeShell ws={ws} />;
}

export default function CodeWorkspacePage() {
  const apiWs = useCodeWorkspace();

  if (!apiWs.ready) {
    return (
      <section className="panel ide-signin-panel">
        <p className="small muted">Loading workspace…</p>
      </section>
    );
  }

  if (!apiWs.token) {
    return <LocalIdeShell />;
  }

  return <IdeShell ws={apiWs} />;
}
