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
  embedded = false,
}) {
  if (!visible || artifacts.length === 0) {
    return null;
  }

  const content = (
    <>
      {!embedded ? (
        <header className="chat-post-run-header">
          <div>
            <h3>Live preview</h3>
            <p className="small">Interactive preview of what the agent built — pick a tab to switch views.</p>
          </div>
          <button type="button" className="ghost-btn small" onClick={onDismiss}>
            Hide
          </button>
        </header>
      ) : (
        <header className="cf-context-section-header">
          <h3>Live preview</h3>
          <p className="small">Pick a tab to switch artifact views.</p>
        </header>
      )}
      <ArtifactPanel
        artifacts={artifacts}
        selectedArtifactId={selectedArtifactId}
        artifactPreviewHtml={artifactPreviewHtml}
        loading={loading}
        onPreview={onPreview}
      />
    </>
  );

  if (embedded) {
    return (
      <div className="founder-preview-panel founder-preview-panel-embedded" aria-label="Live preview">
        {content}
      </div>
    );
  }

  return (
    <section className="chat-post-run-panel founder-preview-panel landing-glass" aria-label="Live preview">
      {content}
    </section>
  );
}
