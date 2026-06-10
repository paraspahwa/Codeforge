"use client";

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

  return (
    <>
      <div className="replay-toolbar">
        {artifacts.map((artifact) => (
          <button
            key={artifact.artifact_id}
            type="button"
            className={`ghost-btn ${selectedArtifactId === artifact.artifact_id ? "ghost-btn-active" : ""}`}
            onClick={() => onPreview(artifact.artifact_id)}
            disabled={loading}
          >
            {artifact.title}
          </button>
        ))}
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
