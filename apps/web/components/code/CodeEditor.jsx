"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { languageForPath } from "../../lib/editor-language";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <p className="small muted code-editor-loading">Loading Monaco editor…</p>,
});

const MONACO_OPTIONS = {
  automaticLayout: true,
  minimap: { enabled: true, scale: 1 },
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
  fontLigatures: true,
  lineNumbers: "on",
  renderLineHighlight: "all",
  scrollBeyondLastLine: false,
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: true,
  bracketPairColorization: { enabled: true },
  guides: {
    bracketPairs: true,
    bracketPairsHorizontal: true,
    indentation: true,
    highlightActiveIndentation: true,
  },
  folding: true,
  foldingHighlight: true,
  foldingImportsByDefault: true,
  showFoldingControls: "mouseover",
  smoothScrolling: true,
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  cursorStyle: "line",
  padding: { top: 10, bottom: 10 },
  scrollbar: {
    verticalScrollbarSize: 12,
    horizontalScrollbarSize: 12,
    useShadows: false,
  },
  suggestOnTriggerCharacters: true,
  quickSuggestions: { other: true, comments: false, strings: true },
  acceptSuggestionOnCommitCharacter: true,
  acceptSuggestionOnEnter: "on",
  tabCompletion: "on",
  wordBasedSuggestions: "matchingDocuments",
  parameterHints: { enabled: true, cycle: true },
  hover: { enabled: true, sticky: true },
  formatOnPaste: true,
  formatOnType: true,
  links: true,
  colorDecorators: true,
  matchBrackets: "always",
  renderWhitespace: "selection",
  occurrencesHighlight: "singleFile",
  selectionHighlight: true,
  codeLens: false,
  contextmenu: true,
  mouseWheelZoom: true,
  multiCursorModifier: "alt",
  stickyScroll: { enabled: true },
  inlineSuggest: { enabled: true },
  semanticHighlighting: { enabled: true },
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: "multiline",
    seedSearchStringFromSelection: "always",
  },
  lightbulb: { enabled: "on" },
  renderValidationDecorations: "on",
  unicodeHighlight: {
    ambiguousCharacters: true,
    invisibleCharacters: true,
  },
};

export default function CodeEditor({
  path,
  value,
  onChange,
  onSave,
  onCursorChange,
  onSelectionChange,
  onEditorReady,
  onInlineEdit,
  onGoToDefinition,
  onFindReferences,
  readOnly = false,
  loading = false,
  wordWrap = "on",
  minimap = true,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const language = useMemo(() => languageForPath(path), [path]);

  const reportCursor = useCallback(
    (editor) => {
      if (!onCursorChange) {
        return;
      }
      const position = editor.getPosition();
      if (position) {
        onCursorChange({ lineNumber: position.lineNumber, column: position.column });
      }
    },
    [onCursorChange],
  );

  const reportSelection = useCallback(
    (editor) => {
      if (!onSelectionChange) {
        return;
      }
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model || selection.isEmpty()) {
        onSelectionChange(null);
        return;
      }
      const text = model.getValueInRange(selection);
      onSelectionChange({
        startLine: selection.startLineNumber,
        endLine: selection.endLineNumber,
        startColumn: selection.startColumn,
        endColumn: selection.endColumn,
        text,
      });
    },
    [onSelectionChange],
  );

  const handleMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      monaco.editor.defineTheme("codeforge-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "64748b", fontStyle: "italic" },
          { token: "keyword", foreground: "c084fc" },
          { token: "string", foreground: "86efac" },
          { token: "number", foreground: "fbbf24" },
        ],
        colors: {
          "editor.background": "#0b1220",
          "editor.foreground": "#e2e8f0",
          "editor.lineHighlightBackground": "#1e293b55",
          "editorGutter.background": "#0b1220",
          "editor.selectionBackground": "#334155aa",
          "editor.inactiveSelectionBackground": "#1e293b88",
          "editorLineNumber.foreground": "#475569",
          "editorLineNumber.activeForeground": "#94a3b8",
          "editorCursor.foreground": "#38bdf8",
          "editorBracketMatch.background": "#334155",
          "editorBracketMatch.border": "#38bdf8",
        },
      });
      monaco.editor.setTheme("codeforge-dark");

      const saveAction = () => {
        if (!readOnly && onSave) {
          onSave();
        }
      };

      editor.addAction({
        id: "codeforge-save",
        label: "Save file",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: saveAction,
      });

      editor.addAction({
        id: "codeforge-format",
        label: "Format document",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI,
        ],
        run: async () => {
          await editor.getAction("editor.action.formatDocument")?.run();
        },
      });

      editor.addAction({
        id: "codeforge-command-palette",
        label: "Show command palette",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP],
        run: () => {
          window.dispatchEvent(new CustomEvent("codeforge:command-palette"));
        },
      });

      editor.addAction({
        id: "codeforge-quick-open",
        label: "Quick open file",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
        run: () => {
          window.dispatchEvent(new CustomEvent("codeforge:quick-open"));
        },
      });

      editor.addAction({
        id: "codeforge-inline-edit",
        label: "Inline edit (Ctrl+K)",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
        run: () => {
          reportSelection(editor);
          const selection = editor.getSelection();
          const model = editor.getModel();
          const payload =
            selection && model && !selection.isEmpty()
              ? {
                  startLine: selection.startLineNumber,
                  endLine: selection.endLineNumber,
                  startColumn: selection.startColumn,
                  endColumn: selection.endColumn,
                  text: model.getValueInRange(selection),
                }
              : null;
          if (onInlineEdit) {
            onInlineEdit(payload);
          } else {
            window.dispatchEvent(new CustomEvent("codeforge:inline-edit", { detail: payload }));
          }
        },
      });

      editor.addAction({
        id: "codeforge-go-to-definition",
        label: "Go to definition",
        keybindings: [monaco.KeyCode.F12],
        run: () => onGoToDefinition?.(editor),
      });

      editor.addAction({
        id: "codeforge-find-references",
        label: "Find references",
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
        run: () => onFindReferences?.(editor),
      });

      editor.onDidChangeCursorPosition(() => reportCursor(editor));
      editor.onDidChangeCursorSelection(() => reportSelection(editor));
      reportCursor(editor);
      reportSelection(editor);
      onEditorReady?.(editor, monaco);
    },
    [onSave, onEditorReady, onInlineEdit, onGoToDefinition, onFindReferences, readOnly, reportCursor, reportSelection],
  );

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        if (!readOnly && onSave) {
          onSave();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave, readOnly]);

  useEffect(() => {
    function onFormatDocument() {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      editor.getAction("editor.action.formatDocument")?.run();
    }
    window.addEventListener("codeforge:format-document", onFormatDocument);
    return () => window.removeEventListener("codeforge:format-document", onFormatDocument);
  }, []);

  if (!path) {
    return (
      <div className="code-editor-empty">
        <p className="small muted">Open a file to start editing</p>
        <p className="small">Press <kbd>Ctrl+P</kbd> for quick open or pick a file from the Explorer sidebar.</p>
        <div className="code-editor-empty-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => window.dispatchEvent(new CustomEvent("codeforge:quick-open"))}
          >
            Quick open (Ctrl+P)
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => window.dispatchEvent(new CustomEvent("codeforge:command-palette"))}
          >
            Command palette
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="code-editor-panel code-editor-panel-full">
      <div className="code-editor-surface code-editor-surface-full">
        <MonacoEditor
          key={path}
          path={path}
          language={language}
          value={value}
          theme="codeforge-dark"
          onChange={(nextValue) => onChange(nextValue ?? "")}
          onMount={handleMount}
          loading={<p className="small muted code-editor-loading">Loading Monaco editor…</p>}
          options={{
            ...MONACO_OPTIONS,
            readOnly: readOnly || loading,
            wordWrap,
            minimap: { ...MONACO_OPTIONS.minimap, enabled: minimap },
          }}
        />
      </div>
    </div>
  );
}
