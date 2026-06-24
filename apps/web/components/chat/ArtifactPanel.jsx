"use client";

const KIND_LABELS = {
  html: "HTML",
  markdown: "Markdown",
  mermaid: "Diagram",
  svg: "SVG",
  jsx: "React",
  tsx: "React TS",
};

export default function ArtifactPanel({
  artifacts,
  selectedArtifactId,
  artifactPreviewHtml,
  loading,
  onPreview,
}) {
  if (artifacts.length === 0) {
    return <p className="small">No artifacts yet.</p>;
  }

  const selected = artifacts.find((item) => item.artifact_id === selectedArtifactId) || artifacts[0];

  function handleExport() {
    if (!selected?.content) {
      return;
    }
    const blob = new Blob([selected.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(selected.title || "artifact").replace(/\s+/g, "-").toLowerCase()}.${selected.kind || "txt"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="replay-toolbar artifact-toolbar">
        {artifacts.map((artifact) => (
          <button
            key={artifact.artifact_id}
            type="button"
            className={`ghost-btn ${selectedArtifactId === artifact.artifact_id ? "ghost-btn-active" : ""}`}
            onClick={() => onPreview(artifact.artifact_id)}
            disabled={loading}
          >
            <span className="artifact-kind-badge">{KIND_LABELS[artifact.kind] || artifact.kind}</span>
            {artifact.title}
          </button>
        ))}
        {selected?.content ? (
          <button type="button" className="ghost-btn small" onClick={handleExport}>
            Export
          </button>
        ) : null}
      </div>
      {artifactPreviewHtml ? (
        <iframe
          title="Artifact preview"
          className="artifact-preview-frame mt-8"
          sandbox="allow-scripts"
          srcDoc={artifactPreviewHtml}
        />
      ) : null}
    </>
  );
}
