"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { canWriteSession } from "@codeforge/shared/sessions";

import {
  createSession,
  decideProposal,
  getFilePreview,
  getGitDiff,
  getGitStatus,
  getProposal,
  getUsageSummary,
  listMessages,
  listSessions,
  runAgentLoop,
  sendMessage,
  streamSession,
} from "./api";
import { useAuth } from "./auth-context";
import { runSlashCommand } from "./slash-commands";
import { useToast } from "./toast-context";

export function useCodeWorkspace() {
  const { token, ready } = useAuth();
  const toast = useToast();

  const [projectPath, setProjectPath] = useState("");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState(null);
  const [gitStatus, setGitStatus] = useState(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [filePreview, setFilePreview] = useState("");
  const [gitDiff, setGitDiff] = useState("");
  const [shellCommand, setShellCommand] = useState("git status");
  const [shellOutput, setShellOutput] = useState("");
  const [pendingProposal, setPendingProposal] = useState(null);
  const [loopVerify, setLoopVerify] = useState("pytest -q");
  const [loopRunning, setLoopRunning] = useState(false);
  const streamRef = useRef(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === sessionId) || null,
    [sessions, sessionId],
  );
  const sessionWritable = useMemo(() => canWriteSession(currentSession), [currentSession]);
  const changedFiles = gitStatus?.changed_files || [];
  const canSend = Boolean(token && sessionId && prompt.trim() && !loading && sessionWritable);

  useEffect(() => {
    setProjectPath(localStorage.getItem("codeforge_project_path") || "");
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

  async function refreshGit(activeToken = token, activeSessionId = sessionId) {
    if (!activeToken || !activeSessionId) {
      return;
    }
    const status = await getGitStatus(activeToken, activeSessionId);
    setGitStatus(status);
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
      const list = await listSessions(token);
      setSessions(list);
      await refreshGit(token, created.session_id);
      toast.push(`Session ${created.session_id} created`, "success");
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
      await refreshGit(token, nextSessionId);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewFile(path) {
    if (!token || !sessionId) {
      return;
    }
    setSelectedFile(path);
    setLoading(true);
    try {
      const [preview, diff] = await Promise.all([
        getFilePreview(token, sessionId, path),
        getGitDiff(token, sessionId, path),
      ]);
      setFilePreview(preview.excerpt || preview.content || "(empty file)");
      setGitDiff(diff?.diff || "");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunShell() {
    if (!token || !sessionId || !shellCommand.trim()) {
      return;
    }
    setLoading(true);
    setShellOutput("");
    try {
      const { streamShellCommand } = await import("./api");
      const lines = [];
      for await (const event of streamShellCommand(token, sessionId, { command: shellCommand.trim() })) {
        if (event.type === "stdout" || event.type === "stderr") {
          lines.push(event.payload?.text || "");
        }
        if (event.type === "exit") {
          lines.push(`\n[exit ${event.payload?.exit_code ?? "?"}]`);
        }
      }
      setShellOutput(lines.join(""));
      await refreshGit();
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
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
      const sent = await sendMessage(sessionId, userText, token);
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
      setPendingProposal(null);
      await refreshGit();
      toast.push(`Proposal ${action}d`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
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

  return {
    ready,
    token,
    projectPath,
    setProjectPath,
    sessions,
    sessionId,
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
    filePreview,
    gitDiff,
    handlePreviewFile,
    shellCommand,
    setShellCommand,
    shellOutput,
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
    refreshGit,
  };
}
