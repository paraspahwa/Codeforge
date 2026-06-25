"use client";

import CodeEditor from "./CodeEditor";
import InlineEditWidget from "./InlineEditWidget";

export default function SplitEditorLayout({ ws, editorProps }) {
  const {
    splitMode,
    activePane,
    setActivePane,
    activePath,
    secondaryPath,
    fileEditorContent,
    secondaryContent,
    setFileEditorContent,
    setSecondaryContent,
  } = ws;

  const primaryActive = activePane === "primary";
  const secondaryActive = activePane === "secondary";

  function renderEditor(path, value, onChange, pane) {
    const isActive = (pane === "primary" && primaryActive) || (pane === "secondary" && secondaryActive);
    return (
      <div
        className={`ide-editor-pane ${isActive ? "ide-editor-pane-active" : ""}`}
        onMouseDown={() => setActivePane(pane)}
      >
        <CodeEditor
          path={path}
          value={value}
          onChange={onChange}
          onSave={pane === "primary" ? ws.handleSaveFile : ws.handleSaveSecondaryFile}
          onCursorChange={pane === "primary" ? ws.setCursor : ws.setSecondaryCursor}
          onSelectionChange={pane === "primary" ? ws.setSelection : ws.setSecondarySelection}
          onHoverContext={pane === "primary" ? ws.setHoverContext : undefined}
          onEditorReady={pane === "primary" ? ws.handleEditorReady : undefined}
          onInlineEdit={ws.handleOpenInlineEdit}
          onGoToDefinition={ws.handleGoToDefinition}
          onFindReferences={ws.handleFindReferences}
          onRequestCompletion={ws.handleRequestCompletion}
          readOnly={!ws.sessionWritable}
          loading={ws.loading}
          wordWrap={ws.wordWrap}
          minimap={ws.minimap && pane === "primary"}
          theme={ws.monacoTheme || "vs-dark"}
        />
      </div>
    );
  }

  if (splitMode === "none") {
    const previewOpen = ws.showPreview && ws.previewHtml;
    return (
      <div className={`ide-editor-stack ${previewOpen ? "ide-editor-stack-with-preview" : ""}`}>
        {renderEditor(activePath, fileEditorContent, setFileEditorContent, "primary")}
        {previewOpen ? (
          <div className="ide-preview-pane">
            <div className="ide-preview-toolbar">
              <span>Live preview</span>
              <button type="button" className="ghost-btn" onClick={() => ws.setShowPreview(false)}>
                Close
              </button>
            </div>
            <iframe
              className="ide-preview-frame"
              title="HTML preview"
              sandbox="allow-scripts allow-same-origin"
              srcDoc={ws.previewHtml}
            />
          </div>
        ) : null}
        <InlineEditWidget
          open={ws.inlineEditOpen}
          path={ws.activePath}
          selection={ws.selection}
          loading={ws.inlineEditLoading}
          preview={ws.inlineEditPreview}
          onSubmit={ws.handleSubmitInlineEdit}
          onAccept={() => ws.handleProposalDecision("approve")}
          onReject={() => ws.handleProposalDecision("reject")}
          onClose={ws.handleCloseInlineEdit}
        />
      </div>
    );
  }

  return (
    <div className={`ide-editor-split ide-editor-split-${splitMode}`}>
      {renderEditor(activePath, fileEditorContent, setFileEditorContent, "primary")}
      <div className="ide-editor-split-divider" />
      {renderEditor(secondaryPath, secondaryContent, setSecondaryContent, "secondary")}
    </div>
  );
}
