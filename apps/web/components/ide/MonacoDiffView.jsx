"use client";

import dynamic from "next/dynamic";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  { ssr: false, loading: () => <p className="small muted">Loading diff…</p> },
);

export default function MonacoDiffView({ original, modified, path }) {
  if (!original && !modified) {
    return <p className="small muted">No diff to display.</p>;
  }

  return (
    <div className="ide-monaco-diff">
      <DiffEditor
        original={original || ""}
        modified={modified || ""}
        language={path?.endsWith(".md") ? "markdown" : "plaintext"}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          automaticLayout: true,
          minimap: { enabled: false },
        }}
      />
    </div>
  );
}
