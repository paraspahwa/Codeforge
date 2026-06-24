"use client";

import ArtifactPanel from "./ArtifactPanel";

export default function FounderPreviewPanel({
  artifacts,
  selectedArtifactId,
  artifactPreviewHtml,
  loading,
  onPreview,
  visible,
  onDismiss,
}) {
  if (!visible || artifacts.length === 0) {
    return null;
  }

  return (
    <section className="chat-post-run-panel founder-preview-panel landing-glass" aria-label="Live preview">
      <header className="chat-post-run-header">
        <div>
          <h3>Live preview</h3>
          <p className="small">Interactive preview of what the agent built — pick a tab to switch views.</p>
        </div>
        <button type="button" className="ghost-btn small" onClick={onDismiss}>
          Hide
        </button>
      </header>
      <ArtifactPanel
        artifacts={artifacts}
        selectedArtifactId={selectedArtifactId}
        artifactPreviewHtml={artifactPreviewHtml}
        loading={loading}
        onPreview={onPreview}
      />
    </section>
  );
}
