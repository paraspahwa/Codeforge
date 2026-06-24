"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canWriteSession } from "@codeforge/shared/sessions";

import {
  applyFile,
  createSession,
  createWorkspaceFile,
  decideProposal,
  deleteWorkspaceFile,
  getDiagnostics,
  getFileContent,
  getGitDiff,
  getGitLog,
  getGitStatus,
  getProposal,
  getUsageSummary,
  listMessages,
  listSessions,
  listWorkspaceFiles,
  lspDefinition,
  lspReferences,
  queryProjectKnowledge,
  renameWorkspaceFile,
  runAgentLoop,
  searchSymbols,
  searchWorkspace,
  sendMessage,
  streamFileWatch,
  streamSession,
  uploadSessionAttachments,
  stageGitFiles,
  commitGitChanges,
} from "./api";
import { useAuth } from "./auth-context";
import { runSlashCommand } from "./slash-commands";
import { useToast } from "./toast-context";

function emptyTab(path, content = "") {
  return { path, content, dirty: false };
}

const DEFAULT_PROJECT_PATH = "/workspaces/demo";

export function useCodeWorkspace() {
  const { token, ready } = useAuth();
  const toast = useToast();

  const [projectPath, setProjectPath] = useState("");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [showChangedOnly, setShowChangedOnly] = useState(false);
  const [tabs, setTabs] = useState([]);
  const [activePath, setActivePath] = useState("");
  const [cursor, setCursor] = useState({ lineNumber: 1, column: 1 });
  const [selection, setSelection] = useState(null);
  const [inlineEditOpen, setInlineEditOpen] = useState(false);
  const [inlineEditLoading, setInlineEditLoading] = useState(false);
  const [inlineEditPreview, setInlineEditPreview] = useState("");
  const [activityView, setActivityView] = useState("explorer");
  const [zenMode, setZenMode] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [outputLines, setOutputLines] = useState([]);
  const [debugLines, setDebugLines] = useState([]);
  const [problems, setProblems] = useState([]);
  const [splitMode, setSplitMode] = useState("none");
  const [secondaryPath, setSecondaryPath] = useState("");
  const [activePane, setActivePane] = useState("primary");
  const [secondaryCursor, setSecondaryCursor] = useState({ lineNumber: 1, column: 1 });
  const [secondarySelection, setSecondarySelection] = useState(null);
  const [composerMode, setComposerMode] = useState("agent");
  const [modelPreference, setModelPreference] = useState("auto");
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showSlashHint, setShowSlashHint] = useState(false);
  const terminalRef = useRef(null);
  const primaryEditorRef = useRef(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState(null);
  const [gitStatus, setGitStatus] = useState(null);
  const [gitDiff, setGitDiff] = useState("");
  const [shellCommand, setShellCommand] = useState("git status");
  const [shellOutput, setShellOutput] = useState("");
  const [pendingProposal, setPendingProposal] = useState(null);
  const [loopVerify, setLoopVerify] = useState("pytest -q");
  const [loopRunning, setLoopRunning] = useState(false);
  const [bottomPanel, setBottomPanel] = useState("terminal");
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [wordWrap, setWordWrap] = useState("on");
  const [minimap, setMinimap] = useState(true);
  const [launchJsonContent, setLaunchJsonContent] = useState("");
  const streamRef = useRef(null);
  const bootstrapRef = useRef(false);

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === sessionId) || null,
    [sessions, sessionId],
  );
  const sessionWritable = useMemo(() => canWriteSession(currentSession), [currentSession]);
  const changedFiles = gitStatus?.changed_files || [];
  const canSend = Boolean(token && sessionId && prompt.trim() && !loading && sessionWritable);

  const activeTab = useMemo(() => tabs.find((tab) => tab.path === activePath) || null, [tabs, activePath]);
  const secondaryTab = useMemo(
    () => tabs.find((tab) => tab.path === secondaryPath) || null,
    [tabs, secondaryPath],
  );
  const fileEditorContent = activeTab?.content || "";
  const secondaryContent = secondaryTab?.content || "";
  const fileDirty = Boolean(activeTab?.dirty);
  const selectedFile = activePath;
  const breadcrumbHeading = useMemo(() => {
    if (!activePath?.endsWith(".md") || !fileEditorContent) {
      return "";
    }
    const line = fileEditorContent.split("\n")[Math.max(0, cursor.lineNumber - 1)] || "";
    const match = line.match(/^#{1,6}\s+(.+)/);
    return match ? match[1].trim() : "";
  }, [activePath, fileEditorContent, cursor.lineNumber]);

  const appendOutput = useCallback((line) => {
    setOutputLines((prev) => [...prev.slice(-500), line]);
  }, []);

  const clearOutput = useCallback(() => setOutputLines([]), []);

  useEffect(() => {
    const stored = localStorage.getItem("codeforge_project_path");
    setProjectPath(stored || DEFAULT_PROJECT_PATH);
  }, []);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    listSessions(token)
      .then(setSessions)
      .catch((error) => toast.push(error.message));
    getUsageSummary(token)
      .then(setUsage)
      .catch(() => undefined);
  }, [ready, token, toast]);

  useEffect(() => () => streamRef.current?.close(), []);

  useEffect(() => {
    function openPalette() {
      setCommandPaletteOpen(true);
    }
    function openQuick() {
      setQuickOpenOpen(true);
    }
    function openInlineEdit(event) {
      setSelection(event.detail || null);
      setInlineEditOpen(true);
      setInlineEditPreview("");
    }
    window.addEventListener("codeforge:command-palette", openPalette);
    window.addEventListener("codeforge:quick-open", openQuick);
    window.addEventListener("codeforge:inline-edit", openInlineEdit);
    return () => {
      window.removeEventListener("codeforge:command-palette", openPalette);
      window.removeEventListener("codeforge:quick-open", openQuick);
      window.removeEventListener("codeforge:inline-edit", openInlineEdit);
    };
  }, []);

  useEffect(() => {
    function onGlobalKeys(event) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "p") {
        const tag = event.target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") {
          return;
        }
        event.preventDefault();
        setQuickOpenOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setActivityView("search");
      }
    }
    window.addEventListener("keydown", onGlobalKeys);
    return () => window.removeEventListener("keydown", onGlobalKeys);
  }, []);

  const syncActiveTab = useCallback((path, patch) => {
    setTabs((prev) => prev.map((tab) => (tab.path === path ? { ...tab, ...patch } : tab)));
  }, []);

  const refreshDiagnostics = useCallback(
    async (path, activeToken = token, activeSessionId = sessionId) => {
      if (!activeToken || !activeSessionId || !path) {
        return;
      }
      try {
        const result = await getDiagnostics(activeToken, activeSessionId, path);
        const items = (result.diagnostics || []).map((item) => ({
          path: item.path || path,
          line: item.line || 1,
          severity: item.severity || "error",
          message: item.message || "Diagnostic",
          source: item.source,
        }));
        setProblems((prev) => [...prev.filter((problem) => problem.path !== path), ...items]);
      } catch {
        // ignore transient diagnostics failures
      }
    },
    [token, sessionId],
  );

  const refreshAllDiagnostics = useCallback(async () => {
    const paths = [...new Set(tabs.map((tab) => tab.path).filter(Boolean))];
    await Promise.all(paths.map((path) => refreshDiagnostics(path)));
  }, [tabs, refreshDiagnostics]);

  async function refreshWorkspaceFiles(activeToken = token, activeSessionId = sessionId) {
    if (!activeToken || !activeSessionId) {
      return;
    }
    const result = await listWorkspaceFiles(activeToken, activeSessionId);
    setWorkspaceFiles(result.files || []);
  }

  async function refreshGit(activeToken = token, activeSessionId = sessionId) {
    if (!activeToken || !activeSessionId) {
      return;
    }
    try {
      const status = await getGitStatus(activeToken, activeSessionId);
      setGitStatus(status);
    } catch {
      setGitStatus(null);
    }
  }

  async function openInitialWorkspaceFile(activeToken, activeSessionId, files) {
    if (!activeToken || !activeSessionId || !files?.length) {
      return;
    }
    const preferred =
      files.find((file) => file === "README.md") ||
      files.find((file) => file.endsWith(".md")) ||
      files.find((file) => !file.endsWith("/")) ||
      files[0];
    if (!preferred) {
      return;
    }
    try {
      const contentPayload = await getFileContent(activeToken, activeSessionId, preferred);
      setTabs([emptyTab(preferred, contentPayload.content || "")]);
      setActivePath(preferred);
    } catch {
      // Explorer still lists files; user can open manually.
    }
  }

  useEffect(() => {
    if (!ready || !token || bootstrapRef.current) {
      return;
    }
    if (sessionId) {
      bootstrapRef.current = true;
      return;
    }

    async function bootstrapWorkspace() {
      const path = (projectPath || DEFAULT_PROJECT_PATH).trim();
      if (!path) {
        return;
      }
      bootstrapRef.current = true;
      if (!localStorage.getItem("codeforge_project_path")) {
        localStorage.setItem("codeforge_project_path", path);
        setProjectPath(path);
      }

      let available = sessions;
      if (available.length === 0) {
        available = await listSessions(token);
        setSessions(available);
      }

      const normalizedPath = path.replace(/\/$/, "");
      const match =
        available.find((session) => (session.project_path || "").replace(/\/$/, "") === normalizedPath) ||
        available.find((session) => (session.project_path || "").includes("demo")) ||
        available[0];

      if (match) {
        const stored = await listMessages(match.session_id, token);
        setSessionId(match.session_id);
        setMessages(stored.map((msg) => ({ id: msg.message_id, role: msg.role, content: msg.content })));
        const fileResult = await listWorkspaceFiles(token, match.session_id);
        const files = fileResult.files || [];
        setWorkspaceFiles(files);
        await openInitialWorkspaceFile(token, match.session_id, files);
        await refreshGit(token, match.session_id);
        return;
      }

      localStorage.setItem("codeforge_project_path", path);
      const created = await createSession(path, token);
      setSessionId(created.session_id);
      setMessages([]);
      const list = await listSessions(token);
      setSessions(list);
      const fileResult = await listWorkspaceFiles(token, created.session_id);
      const files = fileResult.files || [];
      setWorkspaceFiles(files);
      await openInitialWorkspaceFile(token, created.session_id, files);
      await refreshGit(token, created.session_id);
    }

    bootstrapWorkspace().catch((error) => {
      bootstrapRef.current = false;
      toast.push(error.message);
    });
  }, [ready, token, sessions, sessionId, projectPath, toast]);

  useEffect(() => {
    if (!token || !sessionId) {
      setLaunchJsonContent("");
      return;
    }
    getFileContent(token, sessionId, ".vscode/launch.json")
      .then((payload) => setLaunchJsonContent(payload.content || ""))
      .catch(() => setLaunchJsonContent(""));
  }, [token, sessionId]);

  async function loadGitDiff(path) {
    if (!token || !sessionId || !path) {
      setGitDiff("");
      return;
    }
    try {
      const diff = await getGitDiff(token, sessionId, path);
      setGitDiff(diff?.diff || "");
    } catch {
      setGitDiff("");
    }
  }

  async function openFile(path) {
    if (!token || !sessionId) {
      return;
    }

    const existing = tabs.find((tab) => tab.path === path);
    if (existing) {
      setActivePath(path);
      await loadGitDiff(path);
      refreshDiagnostics(path);
      return;
    }

    setLoading(true);
    try {
      const contentPayload = await getFileContent(token, sessionId, path);
      const content = contentPayload.content || "";
      setTabs((prev) => [...prev, emptyTab(path, content)]);
      setActivePath(path);
      await loadGitDiff(path);
      await refreshDiagnostics(path);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  function selectTab(path) {
    if (!tabs.some((tab) => tab.path === path)) {
      return;
    }
    setActivePath(path);
    setActivePane("primary");
    loadGitDiff(path);
    refreshDiagnostics(path);
  }

  function closeTab(path) {
    const tab = tabs.find((item) => item.path === path);
    if (tab?.dirty && !window.confirm(`Discard unsaved changes in ${path}?`)) {
      return;
    }
    const nextTabs = tabs.filter((item) => item.path !== path);
    setTabs(nextTabs);
    setProblems((prev) => prev.filter((problem) => problem.path !== path));
    if (secondaryPath === path) {
      setSplitMode("none");
      setSecondaryPath("");
    }
    if (activePath === path) {
      const fallback = nextTabs[nextTabs.length - 1]?.path || "";
      setActivePath(fallback);
      if (fallback) {
        loadGitDiff(fallback);
      } else {
        setGitDiff("");
      }
    }
  }

  function closeOtherTabs(path) {
    const keep = tabs.find((tab) => tab.path === path);
    if (!keep) {
      return;
    }
    const closing = tabs.filter((tab) => tab.path !== path && tab.dirty);
    if (closing.length > 0 && !window.confirm(`Discard unsaved changes in ${closing.length} file(s)?`)) {
      return;
    }
    setTabs([keep]);
    setActivePath(path);
    setActivePane("primary");
    if (secondaryPath && secondaryPath !== path) {
      setSplitMode("none");
      setSecondaryPath("");
    }
    setProblems((prev) => prev.filter((problem) => problem.path === path));
    loadGitDiff(path);
    refreshDiagnostics(path);
  }

  function closeAllTabs() {
    const dirty = tabs.filter((tab) => tab.dirty);
    if (dirty.length > 0 && !window.confirm(`Discard unsaved changes in ${dirty.length} file(s)?`)) {
      return;
    }
    setTabs([]);
    setActivePath("");
    setSplitMode("none");
    setSecondaryPath("");
    setActivePane("primary");
    setProblems([]);
    setGitDiff("");
  }

  async function splitEditor(path, mode) {
    if (!path) {
      return;
    }
    if (!tabs.some((tab) => tab.path === path)) {
      await openFile(path);
    }
    setSplitMode(mode);
    setSecondaryPath(path);
    setActivePane("secondary");
  }

  async function copyTabPath(path) {
    if (!path) {
      return;
    }
    try {
      await navigator.clipboard.writeText(path);
      toast.push(`Copied ${path}`, "success");
    } catch {
      toast.push("Failed to copy path");
    }
  }

  function closeSplit() {
    setSplitMode("none");
    setSecondaryPath("");
    setActivePane("primary");
  }

  useEffect(() => {
    if (!token || !sessionId) {
      return undefined;
    }
    const watch = streamFileWatch(token, sessionId, async (event) => {
      if (event.type !== "file_changed") {
        return;
      }
      const fileEvents = event.payload?.events || [];
      if (fileEvents.length === 0) {
        return;
      }
      await refreshWorkspaceFiles(token, sessionId);
      for (const fileEvent of fileEvents) {
        const { path, event: change } = fileEvent;
        if (!path) {
          continue;
        }
        if (change === "deleted") {
          setTabs((currentTabs) => {
            const tab = currentTabs.find((item) => item.path === path);
            if (tab?.dirty) {
              return currentTabs;
            }
            const nextTabs = currentTabs.filter((item) => item.path !== path);
            setActivePath((currentActive) => {
              if (currentActive !== path) {
                return currentActive;
              }
              return nextTabs[nextTabs.length - 1]?.path || "";
            });
            return nextTabs;
          });
          setProblems((prev) => prev.filter((problem) => problem.path !== path));
          setSecondaryPath((currentSecondary) => {
            if (currentSecondary === path) {
              setSplitMode("none");
              return "";
            }
            return currentSecondary;
          });
          continue;
        }
        if (change === "created" || change === "changed") {
          setTabs((currentTabs) => {
            const tab = currentTabs.find((item) => item.path === path);
            if (!tab || tab.dirty) {
              return currentTabs;
            }
            getFileContent(token, sessionId, path)
              .then((contentPayload) => {
                syncActiveTab(path, { content: contentPayload.content || "", dirty: false });
                refreshDiagnostics(path);
              })
              .catch(() => undefined);
            return currentTabs;
          });
          refreshDiagnostics(path);
        }
      }
    });
    return () => watch.close();
  }, [token, sessionId, refreshDiagnostics, syncActiveTab]);

  function setFileEditorContent(content) {
    if (!activePath) {
      return;
    }
    syncActiveTab(activePath, { content, dirty: true });
  }

  function setSecondaryContent(content) {
    if (!secondaryPath) {
      return;
    }
    syncActiveTab(secondaryPath, { content, dirty: true });
  }

  async function handleSaveSecondaryFile() {
    if (!token || !sessionId || !secondaryPath || !sessionWritable) {
      return;
    }
    setLoading(true);
    try {
      await applyFile(token, sessionId, { path: secondaryPath, content: secondaryContent });
      syncActiveTab(secondaryPath, { dirty: false });
      await refreshWorkspaceFiles();
      await refreshDiagnostics(secondaryPath);
      await refreshGit();
      toast.push(`Saved ${secondaryPath}`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession() {
    if (!token || !projectPath.trim()) {
      toast.push("Set a project path first");
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem("codeforge_project_path", projectPath.trim());
      const created = await createSession(projectPath.trim(), token);
      setSessionId(created.session_id);
      setMessages([]);
      setPendingProposal(null);
      setTabs([]);
      setActivePath("");
      setSplitMode("none");
      setSecondaryPath("");
      setProblems([]);
      const list = await listSessions(token);
      setSessions(list);
      const fileResult = await listWorkspaceFiles(token, created.session_id);
      const files = fileResult.files || [];
      setWorkspaceFiles(files);
      await openInitialWorkspaceFile(token, created.session_id, files);
      await refreshGit(token, created.session_id);
      toast.push("New session created", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSession(nextSessionId) {
    if (!token || !nextSessionId) {
      return;
    }
    setLoading(true);
    try {
      const stored = await listMessages(nextSessionId, token);
      setSessionId(nextSessionId);
      setMessages(stored.map((msg) => ({ id: msg.message_id, role: msg.role, content: msg.content })));
      setPendingProposal(null);
      setAttachedFiles([]);
      setTabs([]);
      setActivePath("");
      setSplitMode("none");
      setSecondaryPath("");
      setProblems([]);
      const fileResult = await listWorkspaceFiles(token, nextSessionId);
      const files = fileResult.files || [];
      setWorkspaceFiles(files);
      await openInitialWorkspaceFile(token, nextSessionId, files);
      await refreshGit(token, nextSessionId);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewFile(path) {
    await openFile(path);
  }

  async function handleSaveFile() {
    if (!token || !sessionId || !activePath || !sessionWritable) {
      if (!activePath) {
        toast.push("No file open to save");
      }
      return;
    }
    setLoading(true);
    try {
      await applyFile(token, sessionId, { path: activePath, content: fileEditorContent });
      syncActiveTab(activePath, { dirty: false });
      await refreshWorkspaceFiles();
      await loadGitDiff(activePath);
      await refreshDiagnostics(activePath);
      await refreshGit();
      toast.push(`Saved ${activePath}`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAll() {
    if (!token || !sessionId || !sessionWritable) {
      return;
    }
    const dirtyTabs = tabs.filter((tab) => tab.dirty);
    if (dirtyTabs.length === 0) {
      toast.push("No unsaved changes");
      return;
    }
    setLoading(true);
    try {
      for (const tab of dirtyTabs) {
        await applyFile(token, sessionId, { path: tab.path, content: tab.content });
        syncActiveTab(tab.path, { dirty: false });
      }
      await refreshWorkspaceFiles();
      await refreshGit();
      toast.push(`Saved ${dirtyTabs.length} file(s)`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadAttachments(fileList) {
    if (!token || !sessionId || !fileList.length) {
      return;
    }
    setLoading(true);
    try {
      const result = await uploadSessionAttachments(token, sessionId, fileList);
      const paths = (result.uploaded || []).map((item) => item.path);
      setAttachedFiles((prev) => [...new Set([...prev, ...paths])]);
      toast.push(`Attached ${paths.length} file(s)`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAttachWorkspaceFile(path) {
    setAttachedFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }

  function handleRemoveAttachment(path) {
    setAttachedFiles((prev) => prev.filter((item) => item !== path));
  }

  async function handleRunShell() {
    if (!token || !sessionId || !shellCommand.trim()) {
      toast.push("Enter a command to run");
      return;
    }
    setShowBottomPanel(true);
    setBottomPanel("terminal");
    const command = shellCommand.trim();
    appendOutput(`$ ${command}`);
    terminalRef.current?.runCommand?.(command);
    toast.push(`Sent to terminal: ${command}`, "success");
  }

  function buildMessageContext(extra = {}) {
    const context = {
      attached_files: attachedFiles,
      ...extra,
    };
    if (activePath) {
      context.current_file = activePath;
      context.line_number = cursor.lineNumber;
    }
    if (selection?.text) {
      context.selection_start_line = selection.startLine;
      context.selection_end_line = selection.endLine;
      context.selection_text = selection.text;
    }
    return context;
  }

  async function streamAssistantReply(userText, { assistantId, onProposal } = {}) {
    const resolvedAssistantId = assistantId || `a_${Date.now()}`;
    await sendMessage(sessionId, userText, token, buildMessageContext());
    setAttachedFiles([]);
    listSessions(token)
      .then(setSessions)
      .catch(() => undefined);
    streamRef.current?.close();
    streamRef.current = streamSession(sessionId, token, (evt) => {
      if (evt.type === "token") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === resolvedAssistantId ? { ...msg, content: msg.content + (evt.payload?.text || "") } : msg,
          ),
        );
      }
      if (evt.type === "proposal_created") {
        const proposalId = evt.payload?.proposal_id;
        if (proposalId) {
          getProposal(sessionId, proposalId, token)
            .then((proposal) => {
              setPendingProposal(proposal);
              onProposal?.(proposal);
            })
            .catch(() => undefined);
        }
      }
      if (evt.type === "run_completed") {
        setLoading(false);
        setInlineEditLoading(false);
        refreshGit().catch(() => undefined);
      }
    });
  }

  async function handleSendPrompt(event) {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    const userText = prompt.trim();
    setPrompt("");
    setLoading(true);

    if (userText.startsWith("/")) {
      try {
        const commandResult = await runSlashCommand({
          text: userText,
          token,
          projectPath: projectPath || null,
          sessionId,
        });
        if (commandResult.handled) {
          setMessages((prev) => [
            ...prev,
            { id: `u_${Date.now()}`, role: "user", content: userText },
            { id: `a_${Date.now()}`, role: "assistant", content: commandResult.reply || "Done." },
          ]);
          return;
        }
      } finally {
        setLoading(false);
      }
    }

    const assistantId = `a_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", content: userText },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      await sendMessage(sessionId, userText, token, buildMessageContext());
      setAttachedFiles([]);
      listSessions(token)
        .then(setSessions)
        .catch(() => undefined);
      streamRef.current?.close();
      streamRef.current = streamSession(sessionId, token, (evt) => {
        if (evt.type === "token") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: msg.content + (evt.payload?.text || "") } : msg,
            ),
          );
        }
        if (evt.type === "proposal_created") {
          const proposalId = evt.payload?.proposal_id;
          if (proposalId) {
            getProposal(sessionId, proposalId, token).then(setPendingProposal).catch(() => undefined);
          }
        }
        if (evt.type === "run_completed") {
          setLoading(false);
          refreshGit().catch(() => undefined);
        }
      });
    } catch (error) {
      toast.push(error.message);
      setLoading(false);
    }
  }

  async function handleProposalDecision(action) {
    if (!pendingProposal || !token || !sessionId) {
      return;
    }
    setLoading(true);
    try {
      await decideProposal(sessionId, pendingProposal.proposal_id, action, token);
      const target = pendingProposal.target_file;
      setPendingProposal(null);
      setInlineEditPreview("");
      if (action === "approve" && target) {
        const contentPayload = await getFileContent(token, sessionId, target);
        if (tabs.some((tab) => tab.path === target)) {
          syncActiveTab(target, { content: contentPayload.content || "", dirty: false });
        }
      }
      await refreshWorkspaceFiles();
      await refreshGit();
      toast.push(`Proposal ${action}d`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
      setInlineEditLoading(false);
    }
  }

  function handleEditorReady(editor) {
    primaryEditorRef.current = editor;
  }

  function handleOpenInlineEdit(nextSelection) {
    if (!activePath) {
      toast.push("Open a file first");
      return;
    }
    setSelection(nextSelection);
    setInlineEditOpen(true);
    setInlineEditPreview("");
  }

  async function handleFormatDocument() {
    const editor = primaryEditorRef.current;
    if (!editor || !activePath) {
      toast.push("Open a file to format");
      return;
    }
    try {
      await editor.getAction("editor.action.formatDocument")?.run();
      toast.push("Document formatted", "success");
    } catch (error) {
      toast.push(error.message || "Format failed");
    }
  }

  function focusTerminal() {
    setShowBottomPanel(true);
    setBottomPanel("terminal");
    window.setTimeout(() => terminalRef.current?.focus?.(), 50);
  }

  function handleCloseInlineEdit() {
    setInlineEditOpen(false);
    setInlineEditPreview("");
    setInlineEditLoading(false);
  }

  async function handleSubmitInlineEdit(instruction) {
    if (!token || !sessionId || !activePath || !instruction.trim() || !sessionWritable) {
      return;
    }
    const scopedSelection = selection?.text
      ? selection
      : { text: fileEditorContent, startLine: 1, endLine: fileEditorContent.split("\n").length };
    setSelection(scopedSelection);
    setInlineEditLoading(true);
    setLoading(true);
    setShowChatPanel(true);

    const userText = `Apply this inline edit to ${activePath}: ${instruction.trim()}`;
    const assistantId = `a_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", content: userText },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      await streamAssistantReply(userText, {
        assistantId,
        onProposal: (proposal) => {
          setInlineEditPreview(proposal.patch_preview || "");
        },
      });
    } catch (error) {
      toast.push(error.message);
      setInlineEditLoading(false);
      setLoading(false);
    }
  }

  async function handleCreateFile(path) {
    if (!token || !sessionId || !sessionWritable) {
      return;
    }
    setLoading(true);
    try {
      await createWorkspaceFile(token, sessionId, { path, content: "" });
      await refreshWorkspaceFiles();
      await openFile(path);
      toast.push(`Created ${path}`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteFile(path) {
    if (!token || !sessionId || !sessionWritable) {
      return;
    }
    setLoading(true);
    try {
      await deleteWorkspaceFile(token, sessionId, path);
      closeTab(path);
      await refreshWorkspaceFiles();
      toast.push(`Deleted ${path}`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRenameFile(fromPath, toPath) {
    if (!token || !sessionId || !sessionWritable) {
      return;
    }
    setLoading(true);
    try {
      await renameWorkspaceFile(token, sessionId, fromPath, toPath);
      setTabs((prev) => prev.map((tab) => (tab.path === fromPath ? { ...tab, path: toPath } : tab)));
      if (activePath === fromPath) {
        setActivePath(toPath);
      }
      await refreshWorkspaceFiles();
      toast.push(`Renamed ${fromPath} → ${toPath}`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchSymbols(query) {
    return searchSymbols(token, sessionId, query);
  }

  async function handleSearchKnowledge(query) {
    return queryProjectKnowledge(token, { query, session_id: sessionId, top_k: 8 });
  }

  function handleInsertMention(path) {
    handleAttachWorkspaceFile(path);
    setPrompt((prev) => `${prev}${prev ? " " : ""}@${path}`);
  }

  async function handleGoToDefinition(editor) {
    const resolvedEditor = editor || primaryEditorRef.current;
    if (!token || !sessionId || !activePath) {
      toast.push("Open a file first");
      return;
    }
    if (!resolvedEditor) {
      toast.push("Editor not ready — try again");
      return;
    }
    const position = resolvedEditor.getPosition();
    if (!position) {
      return;
    }
    try {
      const result = await lspDefinition(token, sessionId, activePath, position.lineNumber, position.column);
      const hit = result?.locations?.[0];
      if (hit?.file) {
        await openFile(hit.file);
        toast.push(`Definition: ${hit.symbol} in ${hit.file}:${hit.line}`, "success");
      } else {
        toast.push("No definition found");
      }
    } catch (error) {
      toast.push(error.message);
    }
  }

  async function handleFindReferences(editor) {
    const resolvedEditor = editor || primaryEditorRef.current;
    if (!token || !sessionId || !activePath) {
      toast.push("Open a file first");
      return;
    }
    if (!resolvedEditor) {
      toast.push("Editor not ready — try again");
      return;
    }
    const position = resolvedEditor.getPosition();
    if (!position) {
      return;
    }
    try {
      const result = await lspReferences(token, sessionId, activePath, position.lineNumber, position.column);
      const hits = result?.locations || [];
      if (hits.length === 0) {
        toast.push("No references found");
        return;
      }
      setShowSidebar(true);
      setActivityView("search");
      toast.push(`${hits.length} reference(s) found — opening first`);
      await openFile(hits[0].file);
    } catch (error) {
      toast.push(error.message);
    }
  }

  async function openFileAt(path, line = 1) {
    await openFile(path);
    setCursor({ lineNumber: line, column: 1 });
  }

  async function handleWorkspaceSearch(query) {
    return searchWorkspace(token, sessionId, query);
  }

  async function handleLoadGitLog(limit = 15) {
    if (!token || !sessionId) {
      return { commits: [] };
    }
    return getGitLog(token, sessionId, limit);
  }

  async function handleStageAndCommit({ message, paths }) {
    if (!token || !sessionId || !sessionWritable) {
      return;
    }
    setLoading(true);
    try {
      await stageGitFiles(token, sessionId, { paths });
      await commitGitChanges(token, sessionId, message);
      appendOutput(`[git] committed: ${message}`);
      await refreshGit();
      toast.push("Committed changes", "success");
    } catch (error) {
      toast.push(error.message);
      appendOutput(`[git error] ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleDebugInput(expression) {
    const line = `> ${expression}`;
    setDebugLines((prev) => [...prev, line, `[eval] ${expression}`]);
    appendOutput(line);
  }

  function setSidebarPanel(view) {
    setActivityView(view);
  }

  async function handleRunLoop() {
    if (!token || !sessionId) {
      return;
    }
    setLoopRunning(true);
    try {
      const result = await runAgentLoop(sessionId, token, {
        verify_command: loopVerify,
        max_attempts: 3,
        auto_apply: true,
      });
      toast.push(result.passed ? "Verify loop passed" : "Verify loop finished with failures", result.passed ? "success" : undefined);
      await refreshGit();
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoopRunning(false);
    }
  }

  const launchConfigs = useMemo(() => {
    const source = launchJsonContent || tabs.find((tab) => tab.path === ".vscode/launch.json")?.content;
    if (!source) {
      return [
        { name: "Python: Current file", command: "python ${file}" },
        { name: "Node: Current file", command: "node ${file}" },
        { name: "npm test", command: "npm test" },
        { name: "pytest", command: loopVerify || "pytest -q" },
      ];
    }
    try {
      const parsed = JSON.parse(source);
      const configs = parsed.configurations || [];
      if (configs.length === 0) {
        return [{ name: "No configurations", command: "echo add configurations to launch.json" }];
      }
      return configs.map((config) => ({
        name: config.name || "Launch",
        command:
          config.command ||
          [config.runtimeExecutable, config.program, config.module].filter(Boolean).join(" ") ||
          config.type ||
          "run",
      }));
    } catch {
      return [{ name: "Invalid launch.json", command: "echo fix .vscode/launch.json" }];
    }
  }, [tabs, loopVerify, launchJsonContent]);

  function handleRunLaunch(config) {
    const targetFile = activePath || "main.py";
    const command = (config.command || "")
      .replaceAll("${file}", targetFile)
      .replaceAll("${workspaceFolder}", projectPath || ".");
    setShellCommand(command);
    setShowBottomPanel(true);
    setBottomPanel("terminal");
    setShowSidebar(true);
    setActivityView("run");
    appendOutput(`$ ${command}`);
    terminalRef.current?.runCommand?.(command);
    toast.push(`Launch: ${config.name}`, "success");
  }

  function executeIdeCommand(commandId) {
    const runners = {
      save: () => handleSaveFile(),
      "save-all": () => handleSaveAll(),
      "quick-open": () => setQuickOpenOpen(true),
      "new-file": () => {
        const path = window.prompt("New file path", "src/new-file.ts");
        if (path) {
          handleCreateFile(path);
        }
      },
      "close-tab": () => {
        if (activePath) {
          closeTab(activePath);
        } else {
          toast.push("No editor open");
        }
      },
      "close-all": () => closeAllTabs(),
      "inline-edit": () => handleOpenInlineEdit(selection),
      "toggle-wrap": () => setWordWrap((v) => (v === "on" ? "off" : "on")),
      format: () => handleFormatDocument(),
      "split-right": () => {
        if (activePath) {
          splitEditor(activePath, "right");
        } else {
          toast.push("Open a file to split");
        }
      },
      "split-down": () => {
        if (activePath) {
          splitEditor(activePath, "down");
        } else {
          toast.push("Open a file to split");
        }
      },
      "close-split": () => closeSplit(),
      "command-palette": () => setCommandPaletteOpen(true),
      shortcuts: () => setCommandPaletteOpen(true),
      "toggle-explorer": () => {
        setShowSidebar(true);
        setActivityView("explorer");
      },
      "toggle-search": () => {
        setShowSidebar(true);
        setActivityView("search");
      },
      "toggle-scm": () => {
        setShowSidebar(true);
        setActivityView("scm");
      },
      "toggle-run": () => {
        setShowSidebar(true);
        setActivityView("run");
      },
      "toggle-sidebar": () => setShowSidebar((v) => !v),
      "toggle-terminal": () => setShowBottomPanel((v) => !v),
      "toggle-composer": () => setShowChatPanel((v) => !v),
      "toggle-chat": () => setShowChatPanel((v) => !v),
      "toggle-minimap": () => setMinimap((v) => !v),
      problems: () => {
        setShowBottomPanel(true);
        setBottomPanel("problems");
      },
      zen: () => setZenMode((v) => !v),
      "go-definition": () => handleGoToDefinition(),
      "find-references": () => handleFindReferences(),
      "run-shell": () => handleRunShell(),
      "agent-loop": () => handleRunLoop(),
      "new-terminal": () => focusTerminal(),
      "git-status": () => refreshGit(),
    };
    const run = runners[commandId];
    if (run) {
      run();
      return true;
    }
    return false;
  }

  const ideCommands = useMemo(
    () => [
      { id: "save", label: "File: Save", shortcut: "Ctrl+S", run: () => executeIdeCommand("save") },
      { id: "save-all", label: "File: Save all", run: () => executeIdeCommand("save-all") },
      { id: "quick-open", label: "File: Quick open", shortcut: "Ctrl+P", run: () => executeIdeCommand("quick-open") },
      { id: "new-file", label: "File: New file", run: () => executeIdeCommand("new-file") },
      { id: "close-tab", label: "View: Close editor", run: () => executeIdeCommand("close-tab") },
      { id: "close-all", label: "View: Close all editors", run: () => executeIdeCommand("close-all") },
      { id: "toggle-wrap", label: "View: Toggle word wrap", run: () => executeIdeCommand("toggle-wrap") },
      { id: "toggle-minimap", label: "View: Toggle minimap", run: () => executeIdeCommand("toggle-minimap") },
      { id: "toggle-terminal", label: "View: Toggle terminal", run: () => executeIdeCommand("toggle-terminal") },
      { id: "toggle-composer", label: "View: Toggle Composer", run: () => executeIdeCommand("toggle-composer") },
      { id: "toggle-sidebar", label: "View: Toggle sidebar", run: () => executeIdeCommand("toggle-sidebar") },
      { id: "toggle-explorer", label: "View: Explorer", run: () => executeIdeCommand("toggle-explorer") },
      { id: "toggle-search", label: "View: Codebase search", run: () => executeIdeCommand("toggle-search") },
      { id: "toggle-scm", label: "View: Source control", run: () => executeIdeCommand("toggle-scm") },
      { id: "toggle-run", label: "View: Run and Debug", run: () => executeIdeCommand("toggle-run") },
      { id: "inline-edit", label: "Edit: Inline edit (Ctrl+K)", shortcut: "Ctrl+K", run: () => executeIdeCommand("inline-edit") },
      { id: "format", label: "Edit: Format document", shortcut: "Shift+Alt+F", run: () => executeIdeCommand("format") },
      { id: "split-right", label: "View: Split editor right", run: () => executeIdeCommand("split-right") },
      { id: "split-down", label: "View: Split editor down", run: () => executeIdeCommand("split-down") },
      { id: "close-split", label: "View: Close split editor", run: () => executeIdeCommand("close-split") },
      { id: "problems", label: "View: Problems panel", run: () => executeIdeCommand("problems") },
      { id: "zen", label: "View: Zen mode", run: () => executeIdeCommand("zen") },
      { id: "go-definition", label: "Go: Go to definition", shortcut: "F12", run: () => executeIdeCommand("go-definition") },
      { id: "find-references", label: "Go: Find references", shortcut: "Shift+F12", run: () => executeIdeCommand("find-references") },
      { id: "git-status", label: "Git: Refresh status", run: () => executeIdeCommand("git-status") },
      { id: "run-shell", label: "Terminal: Run command", run: () => executeIdeCommand("run-shell") },
      { id: "new-terminal", label: "Terminal: Focus terminal", run: () => executeIdeCommand("new-terminal") },
      { id: "agent-loop", label: "Run: Verify loop", run: () => executeIdeCommand("agent-loop") },
      { id: "command-palette", label: "View: Command palette", shortcut: "Ctrl+Shift+P", run: () => executeIdeCommand("command-palette") },
    ],
    [activePath, selection],
  );

  return {
    ready,
    token,
    projectPath,
    setProjectPath,
    sessions,
    sessionId,
    currentSession,
    workspaceFiles,
    showChangedOnly,
    setShowChangedOnly,
    tabs,
    activePath,
    selectTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    onSplitRight: (path) => splitEditor(path, "right"),
    onSplitDown: (path) => splitEditor(path, "down"),
    onCopyPath: copyTabPath,
    closeSplit,
    openFile,
    fileEditorContent,
    setFileEditorContent,
    secondaryContent,
    setSecondaryContent,
    splitMode,
    secondaryPath,
    activePane,
    setActivePane,
    handleSaveSecondaryFile,
    fileDirty,
    cursor,
    setCursor,
    secondaryCursor,
    setSecondaryCursor,
    selection,
    setSelection,
    secondarySelection,
    setSecondarySelection,
    attachedFiles,
    handleUploadAttachments,
    handleAttachWorkspaceFile,
    handleRemoveAttachment,
    handleSaveFile,
    handleSelectSession,
    handleCreateSession,
    messages,
    prompt,
    setPrompt,
    loading,
    usage,
    gitStatus,
    changedFiles,
    selectedFile,
    gitDiff,
    handlePreviewFile,
    shellCommand,
    setShellCommand,
    shellOutput,
    terminalRef,
    editorRef: primaryEditorRef,
    handleEditorReady,
    executeIdeCommand,
    handleRunShell,
    handleSendPrompt,
    canSend,
    sessionWritable,
    pendingProposal,
    handleProposalDecision,
    loopVerify,
    setLoopVerify,
    loopRunning,
    handleRunLoop,
    launchConfigs,
    handleRunLaunch,
    refreshGit,
    activityView,
    setActivityView,
    sidebarPanel: activityView,
    setSidebarPanel,
    zenMode,
    setZenMode,
    globalSearch,
    setGlobalSearch,
    outputLines,
    clearOutput,
    appendOutput,
    debugLines,
    problems,
    composerMode,
    setComposerMode,
    modelPreference,
    setModelPreference,
    showMentionPicker,
    setShowMentionPicker,
    showSlashHint,
    setShowSlashHint,
    breadcrumbHeading,
    inlineEditOpen,
    inlineEditLoading,
    inlineEditPreview,
    handleOpenInlineEdit,
    handleCloseInlineEdit,
    handleSubmitInlineEdit,
    handleCreateFile,
    handleDeleteFile,
    handleRenameFile,
    handleSearchSymbols,
    handleSearchKnowledge,
    handleInsertMention,
    handleGoToDefinition,
    handleFindReferences,
    openFileAt,
    handleWorkspaceSearch,
    handleLoadGitLog,
    handleStageAndCommit,
    handleDebugInput,
    bottomPanel,
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
    ideCommands,
    wordWrap,
    minimap,
  };
}
