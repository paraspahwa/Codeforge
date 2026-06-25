"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSession, devLogin, sendMessage, streamSession } from "./api";
import { runJavaScript, buildHtmlPreviewDocument, inferRunMode } from "./ide-run-engine";
import {
  loadIdeWorkspace,
  saveIdeWorkspace,
  listFilePaths,
  normalizePath,
} from "./ide-workspace-store";

function emptyTab(path, content = "") {
  return { path, content, dirty: false };
}

/**
 * Local-first IDE workspace (localStorage). Same surface as useCodeWorkspace for IdeShell.
 */
export function useLocalIde() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [files, setFiles] = useState({});
  const [tabs, setTabs] = useState([]);
  const [activePath, setActivePath] = useState("");
  const [cursor, setCursor] = useState({ lineNumber: 1, column: 1 });
  const [selection, setSelection] = useState(null);
  const [editorTheme, setEditorTheme] = useState("dark");
  const [activityView, setActivityView] = useState("explorer");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [composerMode, setComposerMode] = useState("agent");
  const [modelPreference, setModelPreference] = useState("auto");
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showSlashHint, setShowSlashHint] = useState(false);
  const [bottomPanel, setBottomPanel] = useState("output");
  const [outputLines, setOutputLines] = useState([]);
  const [problems, setProblems] = useState([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [wordWrap, setWordWrap] = useState("on");
  const [minimap, setMinimap] = useState(true);
  const [splitMode] = useState("none");
  const terminalRef = useRef(null);
  const streamRef = useRef(null);

  const workspaceFiles = useMemo(() => listFilePaths(files), [files]);

  const localFiles = useMemo(() => {
    const map = { ...files };
    for (const tab of tabs) {
      map[tab.path] = tab.content;
    }
    return map;
  }, [files, tabs]);

  const fileEditorContent = useMemo(() => {
    if (!activePath) {
      return "";
    }
    const tab = tabs.find((item) => item.path === activePath);
    return tab?.content ?? files[activePath] ?? "";
  }, [activePath, tabs, files]);

  const fileDirty = useMemo(
    () => tabs.find((tab) => tab.path === activePath)?.dirty ?? false,
    [tabs, activePath],
  );

  const monacoTheme = editorTheme === "light" ? "vs" : "vs-dark";

  useEffect(() => {
    const saved = loadIdeWorkspace();
    const storedToken = sessionStorage.getItem("codeforge_token");
    if (storedToken) {
      setToken(storedToken);
    }
    setFiles(saved.files);
    setEditorTheme(saved.editorTheme || "dark");
    const initialTabs = (saved.openTabs || []).map((path) => emptyTab(path, saved.files[path] || ""));
    setTabs(initialTabs.length ? initialTabs : [emptyTab("src/index.js", saved.files["src/index.js"])]);
    setActivePath(saved.activePath || initialTabs[0]?.path || "src/index.js");
    setReady(true);
  }, []);

  useEffect(() => () => streamRef.current?.close(), []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const fileMap = { ...files };
    for (const tab of tabs) {
      fileMap[tab.path] = tab.content;
    }
    saveIdeWorkspace({
      files: fileMap,
      openTabs: tabs.map((tab) => tab.path),
      activePath,
      editorTheme,
    });
  }, [ready, files, tabs, activePath, editorTheme]);

  const appendOutput = useCallback((line) => {
    setOutputLines((prev) => [...prev.slice(-500), line]);
  }, []);

  const setFileEditorContent = useCallback(
    (content) => {
      if (!activePath) {
        return;
      }
      setTabs((prev) =>
        prev.map((tab) =>
          tab.path === activePath ? { ...tab, content, dirty: tab.content !== content } : tab,
        ),
      );
    },
    [activePath],
  );

  const openFile = useCallback(
    (path) => {
      const normalized = normalizePath(path);
      if (!normalized || !files[normalized]) {
        return;
      }
      setTabs((prev) => {
        if (prev.some((tab) => tab.path === normalized)) {
          return prev;
        }
        return [...prev, emptyTab(normalized, files[normalized])];
      });
      setActivePath(normalized);
    },
    [files],
  );

  const closeTab = useCallback(
    (path) => {
      setTabs((prev) => {
        const next = prev.filter((tab) => tab.path !== path);
        if (activePath === path) {
          setActivePath(next[next.length - 1]?.path || "");
        }
        return next;
      });
    },
    [activePath],
  );

  const handleSaveFile = useCallback(() => {
    if (!activePath) {
      return;
    }
    const tab = tabs.find((item) => item.path === activePath);
    if (!tab) {
      return;
    }
    setFiles((prev) => ({ ...prev, [activePath]: tab.content }));
    setTabs((prev) => prev.map((item) => (item.path === activePath ? { ...item, dirty: false } : item)));
    appendOutput(`[saved] ${activePath}`);
  }, [activePath, tabs, appendOutput]);

  const handleCreateFile = useCallback(
    (path) => {
      const normalized = normalizePath(path);
      if (!normalized || files[normalized]) {
        return;
      }
      setFiles((prev) => ({ ...prev, [normalized]: "" }));
      setTabs((prev) => [...prev, emptyTab(normalized, "")]);
      setActivePath(normalized);
    },
    [files],
  );

  const handleDeleteFile = useCallback(
    (path) => {
      const normalized = normalizePath(path);
      setFiles((prev) => {
        const next = { ...prev };
        delete next[normalized];
        return next;
      });
      closeTab(normalized);
    },
    [closeTab],
  );

  const handleRenameFile = useCallback(
    (fromPath, toPath) => {
      const from = normalizePath(fromPath);
      const to = normalizePath(toPath);
      if (!from || !to || from === to) {
        return;
      }
      setFiles((prev) => {
        const next = { ...prev };
        next[to] = next[from] ?? "";
        delete next[from];
        return next;
      });
      setTabs((prev) =>
        prev.map((tab) => (tab.path === from ? { ...tab, path: to, dirty: true } : tab)),
      );
      if (activePath === from) {
        setActivePath(to);
      }
    },
    [activePath],
  );

  const handleRunCode = useCallback(() => {
    if (!activePath) {
      appendOutput("[run] No active file");
      return;
    }
    const content = fileEditorContent;
    const mode = inferRunMode(activePath, content);
    setShowBottomPanel(true);
    setBottomPanel("output");
    appendOutput(`[run] ${activePath}`);

    if (mode === "html") {
      setPreviewHtml(buildHtmlPreviewDocument(content));
      setShowPreview(true);
      appendOutput("[preview] HTML rendered in preview pane");
      return;
    }

    if (mode === "json") {
      try {
        JSON.parse(content);
        appendOutput("[ok] Valid JSON");
        setProblems([]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendOutput(`[error] ${message}`);
        setProblems([{ file: activePath, line: 1, message, severity: "error" }]);
      }
      return;
    }

    setProblems([]);
    const result = runJavaScript(content, {
      onLog: (line) => appendOutput(line),
      onError: (line) => appendOutput(line),
    });
    if (!result.ok) {
      setProblems([
        {
          file: activePath,
          line: 1,
          message: result.message || result.errors[0] || "Runtime error",
          severity: "error",
        },
      ]);
    }
  }, [activePath, fileEditorContent, appendOutput]);

  const handleSaveAll = useCallback(() => {
    setFiles((prev) => {
      const next = { ...prev };
      for (const tab of tabs) {
        next[tab.path] = tab.content;
      }
      return next;
    });
    setTabs((prev) => prev.map((tab) => ({ ...tab, dirty: false })));
    appendOutput("[saved] all files");
  }, [tabs, appendOutput]);

  const ensureChatSession = useCallback(async () => {
    let activeToken = token || sessionStorage.getItem("codeforge_token");
    if (!activeToken) {
      try {
        activeToken = await devLogin("local-editor");
        sessionStorage.setItem("codeforge_token", activeToken);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendOutput(`[chat error] ${message}`);
        return null;
      }
    }
    if (!token) {
      setToken(activeToken);
    }

    if (sessionId) {
      return { token: activeToken, sessionId };
    }
    try {
      const created = await createSession("/workspaces/local-editor", activeToken);
      setSessionId(created.session_id);
      return { token: activeToken, sessionId: created.session_id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendOutput(`[chat error] ${message}`);
      return null;
    }
  }, [appendOutput, sessionId, token]);

  const handleSendPrompt = useCallback(
    async (event) => {
      event.preventDefault();
      const userText = prompt.trim();
      if (!userText || loading) {
        return;
      }
      setPrompt("");
      setShowChatPanel(true);
      setLoading(true);
      setShowSlashHint(userText.startsWith("/"));
      const assistantId = `a_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: "user", content: userText },
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const resolved = await ensureChatSession();
      if (!resolved) {
        setLoading(false);
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? { ...item, content: "Could not connect chat backend. Sign in or enable dev login." }
              : item,
          ),
        );
        return;
      }
      const { token: activeToken, sessionId: activeSessionId } = resolved;
      try {
        await sendMessage(activeSessionId, userText, activeToken, {
          current_file: activePath || undefined,
          selection_text: selection?.text || undefined,
          line_number: cursor?.lineNumber || 1,
        });
        streamRef.current?.close();
        streamRef.current = streamSession(activeSessionId, activeToken, (evt) => {
          if (evt.type === "token") {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? { ...item, content: item.content + (evt.payload?.text || "") }
                  : item,
              ),
            );
          }
          if (evt.type === "run_completed") {
            setLoading(false);
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId ? { ...item, content: `Request failed: ${message}` } : item,
          ),
        );
        setLoading(false);
      }
    },
    [activePath, cursor?.lineNumber, ensureChatSession, loading, prompt, selection?.text],
  );

  const executeIdeCommand = useCallback(
    (commandId) => {
      const runners = {
        save: () => handleSaveFile(),
        "save-all": () => handleSaveAll(),
        "new-file": () => {
          const path = window.prompt("New file path (e.g. src/app.js):");
          if (path?.trim()) {
            handleCreateFile(path.trim());
          }
        },
        "close-tab": () => activePath && closeTab(activePath),
        "close-all": () => {
          setTabs([]);
          setActivePath("");
        },
        "toggle-terminal": () => {
          setShowBottomPanel(true);
          setBottomPanel("terminal");
        },
        problems: () => {
          setShowBottomPanel(true);
          setBottomPanel("problems");
        },
        "toggle-sidebar": () => setShowSidebar((value) => !value),
        "toggle-wrap": () => setWordWrap((value) => (value === "on" ? "off" : "on")),
        "toggle-minimap": () => setMinimap((value) => !value),
        "command-palette": () => setCommandPaletteOpen(true),
        "quick-open": () => setQuickOpenOpen(true),
        "run-shell": () => handleRunCode(),
        "toggle-composer": () => setShowChatPanel((value) => !value),
        zen: () => setZenMode((value) => !value),
        "toggle-explorer": () => {
          setShowSidebar(true);
          setActivityView("explorer");
        },
        "toggle-search": () => {
          setShowSidebar(true);
          setActivityView("search");
        },
      };
      runners[commandId]?.();
    },
    [handleSaveFile, handleSaveAll, handleRunCode, handleCreateFile, activePath, closeTab],
  );

  useEffect(() => {
    function onRunShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleRunCode();
      }
    }
    window.addEventListener("keydown", onRunShortcut);
    return () => window.removeEventListener("keydown", onRunShortcut);
  }, [handleRunCode]);

  const ideCommands = useMemo(
    () => [
      { id: "save", label: "File: Save", shortcut: "Ctrl+S" },
      { id: "quick-open", label: "File: Quick open", shortcut: "Ctrl+P" },
      { id: "run-shell", label: "Run: Execute file", shortcut: "Ctrl+Shift+R" },
      { id: "toggle-composer", label: "View: Toggle Composer" },
      { id: "toggle-terminal", label: "View: Toggle terminal" },
      { id: "problems", label: "View: Problems" },
      { id: "toggle-sidebar", label: "View: Toggle sidebar" },
    ],
    [],
  );

  return {
    ready: true,
    token,
    localMode: true,
    projectPath: "local://workspace",
    setProjectPath: () => undefined,
    sessions: [],
    sessionId,
    currentSession: null,
    sessionWritable: true,
    workspaceFiles,
    showChangedOnly: false,
    setShowChangedOnly: () => undefined,
    tabs,
    activePath,
    selectTab: openFile,
    closeTab,
    closeOtherTabs: (path) => setTabs((prev) => prev.filter((tab) => tab.path === path)),
    closeAllTabs: () => {
      setTabs([]);
      setActivePath("");
    },
    onSplitRight: () => undefined,
    onSplitDown: () => undefined,
    onCopyPath: () => undefined,
    closeSplit: () => undefined,
    openFile,
    fileEditorContent,
    setFileEditorContent,
    secondaryContent: "",
    setSecondaryContent: () => undefined,
    splitMode,
    secondaryPath: "",
    activePane: "primary",
    setActivePane: () => undefined,
    handleSaveSecondaryFile: () => undefined,
    fileDirty,
    cursor,
    setCursor,
    secondaryCursor: { lineNumber: 1, column: 1 },
    setSecondaryCursor: () => undefined,
    selection,
    setSelection,
    secondarySelection: null,
    setSecondarySelection: () => undefined,
    attachedFiles: [],
    handleUploadAttachments: () => undefined,
    handleAttachWorkspaceFile: () => undefined,
    handleRemoveAttachment: () => undefined,
    handleSaveFile,
    handleSelectSession: () => undefined,
    handleCreateSession: () => undefined,
    messages,
    prompt,
    setPrompt,
    loading,
    usage: null,
    gitStatus: null,
    changedFiles: [],
    selectedFile: activePath,
    gitDiff: "",
    handlePreviewFile: () => undefined,
    shellCommand: "",
    setShellCommand: () => undefined,
    shellOutput: "",
    terminalRef,
    editorRef: { current: null },
    handleEditorReady: () => undefined,
    executeIdeCommand,
    handleRunShell: handleRunCode,
    handleSendPrompt,
    canSend: Boolean(prompt.trim() && !loading),
    pendingProposal: null,
    handleProposalDecision: () => undefined,
    loopVerify: "",
    setLoopVerify: () => undefined,
    loopRunning: false,
    handleRunLoop: () => undefined,
    launchConfigs: [{ name: "Run current file", command: "run" }],
    handleRunLaunch: () => handleRunCode(),
    refreshGit: () => undefined,
    activityView,
    setActivityView,
    sidebarPanel: activityView,
    setSidebarPanel: setActivityView,
    zenMode,
    setZenMode,
    globalSearch,
    setGlobalSearch,
    outputLines,
    clearOutput: () => setOutputLines([]),
    appendOutput,
    debugLines: [],
    problems,
    composerMode,
    setComposerMode,
    modelPreference,
    setModelPreference,
    showMentionPicker,
    setShowMentionPicker,
    showSlashHint,
    setShowSlashHint,
    breadcrumbHeading: "",
    inlineEditOpen: false,
    inlineEditLoading: false,
    inlineEditPreview: "",
    handleOpenInlineEdit: () => undefined,
    handleCloseInlineEdit: () => undefined,
    handleRequestCompletion: async () => ({ completion: "" }),
    handleSubmitInlineEdit: () => undefined,
    handleCreateFile,
    handleDeleteFile,
    handleRenameFile,
    handleSearchSymbols: async () => ({ matches: [] }),
    handleSearchKnowledge: async () => ({ chunks: [] }),
    handleInsertMention: () => undefined,
    openFileAt: openFile,
    handleLoadGitLog: async () => ({ commits: [] }),
    handleGoToDefinition: () => undefined,
    handleFindReferences: () => undefined,
    handleFormatDocument: () => undefined,
    handleSaveAll,
    handleDebugInput: (value) => appendOutput(`> ${value}`),
    bottomPanel,
    setBottomPanel,
    showBottomPanel,
    setShowBottomPanel,
    showChatPanel,
    setShowChatPanel,
    showSidebar,
    setShowSidebar,
    commandPaletteOpen,
    setCommandPaletteOpen,
    quickOpenOpen,
    setQuickOpenOpen,
    wordWrap,
    minimap,
    ideCommands,
    editorTheme,
    setEditorTheme,
    monacoTheme,
    previewHtml,
    showPreview,
    setShowPreview,
    handleRunCode,
    localTerminal: true,
    localFiles,
    magicPointerArmed: false,
    pointerEntities: [],
    handlePointerEntityAction: () => undefined,
    setHoverContext: () => undefined,
  };
}
