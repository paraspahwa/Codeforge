import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, Newline, render, useApp, useInput } from "ink";
import fs from "node:fs";
import path from "node:path";
import {
  createSession,
  applyGitConflictAssist,
  branchGitRepo,
  commitGitChanges,
  decideProposal,
  devLogin,
  getGitDiff,
  getGitConflictGuide,
  getGitLog,
  getGitMergeAssist,
  getGitStatus,
  getProposal,
  listMessages,
  listSessions,
  listGitWorktrees,
  sendMessage,
  stageGitFiles,
  createGitWorktree,
  streamSessionEvents,
  streamShellCommand,
} from "@codeforge/shared/api";
import { formatEvent } from "@codeforge/shared/sse";

const DEFAULT_BASE_URL = process.env.CODEFORGE_API_BASE_URL || "http://127.0.0.1:8000";
const DEFAULT_USER_ID = process.env.CODEFORGE_USER_ID || "dev-user";
const DEFAULT_PROJECT_PATH = process.cwd();
const DEFAULT_MODEL = process.env.CODEFORGE_MODEL || "deepseek-v4-flash";
const MAX_MESSAGES = 30;
const MAX_EVENTS = 8;
const MAX_DIFF_LINES = 10;
const MAX_TREE_ENTRIES = 8;
const MAX_LOOP_ATTEMPTS = 5;
const MODE_ORDER = ["code", "chat", "review"];
const PANE_ORDER = ["files", "sessions", "chat", "review", "activity"];

const PALETTE_ACTIONS = [
  { label: "Mode: Code", value: "mode:code" },
  { label: "Mode: Chat", value: "mode:chat" },
  { label: "Mode: Review", value: "mode:review" },
  { label: "Compact context", value: "compact" },
  { label: "Ultra review", value: "ultrareview" },
  { label: "Plan files", value: "plan" },
  { label: "Rollback plan", value: "rollback" },
  { label: "Loop verify", value: "loop" },
  { label: "Refresh", value: "refresh" },
  { label: "Clear workspace", value: "clear" },
  { label: "Git status", value: "git status" },
  { label: "Git diff", value: "git diff" },
  { label: "Run shell", value: "run" },
  { label: "Approve proposal", value: "approve" },
  { label: "Reject proposal", value: "reject" },
];

function truncate(text, limit) {
  if (!text) {
    return "";
  }

  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function splitPreview(text, limit = MAX_DIFF_LINES) {
  if (!text) {
    return ["No diff yet."];
  }

  return text
    .split("\n")
    .slice(0, limit)
    .map((line) => truncate(line, 78));
}

function buildFileTree(projectPath, limit = MAX_TREE_ENTRIES) {
  try {
    const entries = fs
      .readdirSync(projectPath, { withFileTypes: true })
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((entry) => `${entry.isDirectory() ? "[D]" : "[F]"} ${truncate(entry.name, 24)}`);

    return entries.length > 0 ? entries : ["(empty)"];
  } catch {
    return ["(unavailable)"];
  }
}

function splitShellWords(input) {
  return input.match(/"[^"]*"|'[^']*'|\S+/g) || [];
}

function stripQuotes(value) {
  if (!value) {
    return "";
  }

  return value.replace(/^['"]|['"]$/g, "");
}

function normalizeWorkspacePath(projectPath, candidate) {
  if (!candidate) {
    return null;
  }

  const cleaned = stripQuotes(candidate.trim());
  if (!cleaned) {
    return null;
  }

  const absolutePath = path.isAbsolute(cleaned) ? cleaned : path.join(projectPath, cleaned);
  const resolvedPath = path.resolve(absolutePath);
  const resolvedRoot = path.resolve(projectPath);
  const relativePath = path.relative(resolvedRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return relativePath.split(path.sep).join("/");
}

function readWorkspaceFile(projectPath, relativePath) {
  const absolutePath = path.join(projectPath, relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function writeWorkspaceFile(projectPath, relativePath, content) {
  const absolutePath = path.join(projectPath, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

function buildFileSnapshot(projectPath, targets) {
  const snapshot = {};
  const summary = [];

  targets.forEach((target) => {
    try {
      const content = readWorkspaceFile(projectPath, target);
      snapshot[target] = content;
      summary.push(`- ${target} (${content.split("\n").length} line(s))`);
      summary.push(...content.split("\n").slice(0, 4).map((line) => `  ${truncate(line, 72)}`));
    } catch {
      summary.push(`- ${target} (unavailable)`);
    }
  });

  return { snapshot, summary: summary.length > 0 ? summary : ["No files selected."] };
}

function restoreFileSnapshot(projectPath, snapshot) {
  const restored = [];

  Object.entries(snapshot || {}).forEach(([relativePath, content]) => {
    writeWorkspaceFile(projectPath, relativePath, content);
    restored.push(relativePath);
  });

  return restored;
}

function parseLoopCommand(argumentText) {
  const tokens = splitShellWords(argumentText).map(stripQuotes);
  const result = {
    verifyCommand: "",
    prompt: "",
    maxAttempts: MAX_LOOP_ATTEMPTS,
  };

  const promptTokens = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "--verify" && tokens[index + 1]) {
      result.verifyCommand = tokens[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--verify=")) {
      result.verifyCommand = token.slice("--verify=".length);
      continue;
    }

    if (token === "--prompt" && tokens[index + 1]) {
      promptTokens.push(tokens[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith("--prompt=")) {
      promptTokens.push(token.slice("--prompt=".length));
      continue;
    }

    if (token === "--max" && tokens[index + 1]) {
      result.maxAttempts = Number.parseInt(tokens[index + 1], 10) || MAX_LOOP_ATTEMPTS;
      index += 1;
      continue;
    }

    if (token.startsWith("--max=")) {
      result.maxAttempts = Number.parseInt(token.slice("--max=".length), 10) || MAX_LOOP_ATTEMPTS;
      continue;
    }

    promptTokens.push(token);
  }

  result.prompt = promptTokens.join(" ").trim();
  result.maxAttempts = Math.max(1, Math.min(result.maxAttempts, MAX_LOOP_ATTEMPTS));
  return result;
}

function findPaletteAction(query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  return PALETTE_ACTIONS.find((action) => action.label.toLowerCase().includes(trimmed) || action.value.includes(trimmed)) || null;
}

function getModeHint(mode) {
  if (mode === "chat") {
    return "Tab panes | Ctrl+←/→ mode | ↑/↓ session | Ctrl+R refresh | Ctrl+P palette";
  }

  if (mode === "review") {
    return "Tab panes | Ctrl+←/→ mode | ↑/↓ session | Ctrl+Y approve | Ctrl+N reject | Ctrl+O target | Ctrl+D diff | Ctrl+Shift+U ultrareview";
  }

  return "Tab panes | Ctrl+←/→ mode | ↑/↓ session | Ctrl+R refresh | Ctrl+K compact | Ctrl+P palette";
}

function App() {
  const { exit } = useApp();
  const [bootStatus, setBootStatus] = useState("Ready to login");
  const [baseUrl] = useState(DEFAULT_BASE_URL);
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [token, setToken] = useState("");
  const [projectPath, setProjectPath] = useState(DEFAULT_PROJECT_PATH);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState("");
  const [reviewTitle, setReviewTitle] = useState("No proposal yet");
  const [diffPreview, setDiffPreview] = useState("");
  const [shellPreview, setShellPreview] = useState("");
  const [gitSummary, setGitSummary] = useState("No git state loaded");
  const [activeMode, setActiveMode] = useState("code");
  const [activePane, setActivePane] = useState("chat");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteDraft, setPaletteDraft] = useState("");
  const [currentProposalId, setCurrentProposalId] = useState("");
  const [currentProposal, setCurrentProposal] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [loopState, setLoopState] = useState({ running: false, lastSummary: "" });
  const [error, setError] = useState("");

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === currentSessionId) || null,
    [currentSessionId, sessions],
  );

  const pushEvent = (line) => {
    setEvents((previous) => [line, ...previous].slice(0, MAX_EVENTS));
  };

  const runVerifyCommand = async (sessionId, verifyCommand) => {
    let finalResult = { ok: false, summary: "verify command did not run" };
    for await (const event of streamShellCommand(baseUrl, token, sessionId, {
      command: verifyCommand,
      timeout_seconds: 60,
    })) {
      pushEvent(formatEvent(event));
      if (event.type === "shell_output") {
        setShellPreview(event.payload?.content || "");
      }
      if (event.type === "shell_result") {
        const exitCode = event.payload?.exit_code ?? 1;
        finalResult = {
          ok: exitCode === 0,
          summary: `verify exit ${exitCode} | ${event.payload?.output_lines ?? 0} line(s)`,
        };
        setShellPreview(finalResult.summary);
      }
    }
    return finalResult;
  };

  const runAgentTurn = async (sessionId, prompt) => {
    await sendMessage(baseUrl, token, sessionId, {
      content: prompt,
      context: {
        workspace_path: projectPath,
        selection: null,
        active_file: null,
      },
    });

    let proposalId = "";
    let assistantText = "";

    for await (const event of streamSessionEvents(baseUrl, token, sessionId)) {
      if (event.type === "token") {
        assistantText += event.content || "";
        setStreamingAssistant(assistantText);
        continue;
      }

      pushEvent(formatEvent(event));

      if (event.type === "run_started" && event.payload?.proposal_id) {
        proposalId = event.payload.proposal_id;
      }

      if ((event.type === "diff" || event.type === "approval_request") && event.payload?.proposal_id) {
        proposalId = event.payload.proposal_id;
      }
    }

    setStreamingAssistant("");
    if (proposalId) {
      setCurrentProposalId(proposalId);
      await loadProposal(proposalId, token).catch(() => null);
    }

    return { proposalId };
  };

  const runLoopWorkflow = async ({ verifyCommand, prompt, maxAttempts }) => {
    const sessionId = await ensureSession(token);
    const verifyLabel = verifyCommand || "npm test";
    const fixedPrompt = prompt || "Fix the failing verification command and propose minimal changes.";
    const attempts = [];

    setLoopState({ running: true, lastSummary: "loop running" });
    setReviewTitle("Loop workflow");
    setDiffPreview(`verify: ${verifyLabel}\nmax attempts: ${maxAttempts}`);

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        pushEvent(`loop:${attempt}/${maxAttempts} verify`);
        const verify = await runVerifyCommand(sessionId, verifyLabel);
        attempts.push(`attempt ${attempt}: ${verify.summary}`);

        if (verify.ok) {
          const doneSummary = `Loop passed in ${attempt} attempt(s)`;
          setLoopState({ running: false, lastSummary: doneSummary });
          setReviewTitle("Loop workflow result");
          setDiffPreview([doneSummary, ...attempts].join("\n"));
          pushEvent(doneSummary);
          await refreshMessages(sessionId, token);
          return;
        }

        pushEvent(`loop:${attempt}/${maxAttempts} fix`);
        const turn = await runAgentTurn(
          sessionId,
          `${fixedPrompt}\n\nVerification command: ${verifyLabel}\nLatest verify result: ${verify.summary}\nAttempt: ${attempt}/${maxAttempts}`,
        );

        if (turn.proposalId) {
          pushEvent(`loop proposal ${turn.proposalId}`);
          await resolveProposal("approve", turn.proposalId, false);
          pushEvent(`loop applied ${turn.proposalId}`);
        } else {
          pushEvent("loop no proposal returned");
        }
      }

      const failSummary = `Loop reached max attempts (${maxAttempts}) without passing verification.`;
      setLoopState({ running: false, lastSummary: failSummary });
      setReviewTitle("Loop workflow result");
      setDiffPreview([failSummary, ...attempts].join("\n"));
      pushEvent(failSummary);
      await refreshMessages(sessionId, token);
    } catch (loopError) {
      setLoopState({ running: false, lastSummary: loopError.message });
      throw loopError;
    }
  };

  const createMultiFilePlan = (rawTargets) => {
    const normalizedTargets = Array.from(
      new Set(
        rawTargets
          .map((target) => normalizeWorkspacePath(projectPath, target))
          .filter(Boolean),
      ),
    );

    if (normalizedTargets.length === 0) {
      throw new Error("Usage: /plan <file1> <file2> ...");
    }

    const createdAt = new Date().toISOString();
    const { snapshot, summary } = buildFileSnapshot(projectPath, normalizedTargets);
    const planId = `plan_${Date.now().toString(36)}`;
    const plan = {
      planId,
      createdAt,
      targets: normalizedTargets,
      snapshot,
    };
    setActivePlan(plan);
    setReviewTitle(`Multi-file plan ${planId}`);
    setDiffPreview([
      `Plan ${planId}`,
      `Created: ${createdAt}`,
      "Targets:",
      ...summary,
      "",
      "Run /rollback to restore this snapshot after grouped edits.",
    ].join("\n"));
    pushEvent(`plan created ${planId} (${normalizedTargets.length} file(s))`);
    return plan;
  };

  const executeMultiFilePlan = async (prompt) => {
    if (!activePlan) {
      throw new Error("No active plan. Run /plan <files...> first.");
    }

    const sessionId = await ensureSession(token);
    const planPrompt = prompt || "Apply the requested grouped update safely.";
    const applied = [];

    setReviewTitle(`Executing ${activePlan.planId}`);
    setDiffPreview([
      `Plan: ${activePlan.planId}`,
      `Targets: ${activePlan.targets.join(", ")}`,
      `Prompt: ${planPrompt}`,
      "",
      "Running grouped file updates...",
    ].join("\n"));

    try {
      for (const target of activePlan.targets) {
        pushEvent(`plan run ${target}`);
        const turn = await runAgentTurn(
          sessionId,
          `${planPrompt}\n\nTarget file: ${target}\nKeep the change focused on this file and maintain compatibility with related files.`,
        );

        if (!turn.proposalId) {
          throw new Error(`No proposal produced for ${target}`);
        }

        await resolveProposal("approve", turn.proposalId, false);
        applied.push({ target, proposalId: turn.proposalId });
        pushEvent(`plan applied ${target}`);
      }

      setActivePlan((previous) => (previous ? {
        ...previous,
        lastExecution: {
          status: "applied",
          applied,
          prompt: planPrompt,
          executedAt: new Date().toISOString(),
        },
      } : previous));
      setReviewTitle(`Plan applied ${activePlan.planId}`);
      setDiffPreview([
        `Plan ${activePlan.planId} applied successfully.`,
        ...applied.map((entry) => `- ${entry.target} via ${entry.proposalId}`),
        "",
        "Run /rollback to restore the pre-plan snapshot if needed.",
      ].join("\n"));
      await refreshMessages(sessionId, token);
    } catch (planError) {
      const restored = restoreFileSnapshot(projectPath, activePlan.snapshot);
      setReviewTitle(`Plan rolled back ${activePlan.planId}`);
      setDiffPreview([
        `Grouped apply failed: ${planError.message}`,
        `Rollback restored ${restored.length} file(s):`,
        ...restored.map((item) => `- ${item}`),
      ].join("\n"));
      setActivePlan((previous) => (previous ? {
        ...previous,
        lastExecution: {
          status: "rolled_back",
          applied,
          error: planError.message,
          executedAt: new Date().toISOString(),
        },
      } : previous));
      pushEvent(`plan rollback ${activePlan.planId}`);
      throw planError;
    }
  };

  const rollbackMultiFilePlan = () => {
    if (!activePlan) {
      throw new Error("No active plan. Run /plan <files...> first.");
    }

    const restored = restoreFileSnapshot(projectPath, activePlan.snapshot);
    setReviewTitle(`Rollback ${activePlan.planId}`);
    setDiffPreview([
      `Rollback complete for ${activePlan.planId}`,
      `Restored ${restored.length} file(s)`,
      ...restored.map((item) => `- ${item}`),
    ].join("\n"));
    setActivePlan(null);
    pushEvent(`rollback complete ${restored.length} file(s)`);
  };

  const cycleMode = (delta) => {
    setActiveMode((previous) => {
      const index = MODE_ORDER.indexOf(previous);
      const nextIndex = (index + delta + MODE_ORDER.length) % MODE_ORDER.length;
      const nextMode = MODE_ORDER[nextIndex];
      pushEvent(`Mode switched to ${nextMode}`);
      return nextMode;
    });
  };

  const cyclePane = (delta) => {
    setActivePane((previous) => {
      const index = PANE_ORDER.indexOf(previous);
      const nextIndex = (index + delta + PANE_ORDER.length) % PANE_ORDER.length;
      const nextPane = PANE_ORDER[nextIndex];
      pushEvent(`Pane focused: ${nextPane}`);
      return nextPane;
    });
  };

  const buildCompactSummary = () => {
    const lines = [
      `Mode: ${activeMode}`,
      `Session: ${currentSessionId || "none"}`,
      `Project: ${projectPath || "unknown"}`,
      `Proposal: ${currentProposalId ? `${currentProposalId} (${currentProposal?.status || "pending"})` : "none"}`,
      `Plan: ${activePlan ? `${activePlan.planId} (${activePlan.targets.length} files)` : "none"}`,
      `Loop: ${loopState.running ? "running" : (loopState.lastSummary || "idle")}`,
      `Review: ${reviewTitle}`,
      `Diff: ${truncate(diffPreview || gitSummary || "no diff loaded", 180)}`,
      `Shell: ${truncate(shellPreview || "no shell output yet", 180)}`,
      `Events: ${events.slice(0, 3).join(" | ") || "none"}`,
      `Messages: ${messages.length}`,
    ];

    return lines.join("\n");
  };

  const buildUltrareviewAudit = () => {
    const findings = [];

    if (!currentSessionId) {
      findings.push("No active session selected.");
    }

    if (!currentProposalId && !diffPreview && !gitSummary) {
      findings.push("No proposal or git diff loaded for inspection.");
    }

    if (currentProposal?.status === "pending") {
      findings.push(`Proposal ${currentProposalId} is still pending review.`);
    }

    if (shellPreview && shellPreview.toLowerCase().includes("exit 1")) {
      findings.push("Last shell run ended with a non-zero exit code.");
    }

    if (events.length === 0) {
      findings.push("No activity events captured yet.");
    }

    if (activePlan && (!activePlan.lastExecution || activePlan.lastExecution.status !== "applied")) {
      findings.push(`Multi-file plan ${activePlan.planId} is not fully applied.`);
    }

    if (loopState.running) {
      findings.push("Loop workflow is still running.");
    }

    const auditLines = [
      `Scope: ${reviewTitle}`,
      `Target: ${currentProposal?.target_file || "unknown"}`,
      `Plan: ${activePlan ? activePlan.planId : "none"}`,
      `Loop: ${loopState.lastSummary || "idle"}`,
      `Risk signals:`,
      ...(findings.length > 0 ? findings.map((finding) => `- ${finding}`) : ["- No obvious issues from the current surface state."]),
      `Suggested checks:`,
      "- Re-run the relevant diff or proposal before applying changes.",
      "- Verify the shell output and the latest session events.",
      "- Confirm approval state before any file write.",
    ];

    return auditLines.join("\n");
  };

  const selectSessionByDelta = async (delta) => {
    if (sessions.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      sessions.findIndex((session) => session.session_id === currentSessionId),
    );
    const nextIndex = (currentIndex + delta + sessions.length) % sessions.length;
    const nextSessionId = sessions[nextIndex].session_id;
    setCurrentSessionId(nextSessionId);
    await refreshMessages(nextSessionId, token);
    pushEvent(`Switched to ${nextSessionId}`);
  };

  const loadProposal = async (proposalId, activeToken = token) => {
    if (!proposalId || !currentSessionId || !activeToken) {
      return null;
    }

    const proposal = await getProposal(baseUrl, activeToken, currentSessionId, proposalId);
    setCurrentProposalId(proposalId);
    setCurrentProposal(proposal);
    setReviewTitle(`Proposal: ${proposal.target_file}`);
    setDiffPreview(proposal.patch_preview || proposal.proposed_content || proposal.target_file);
    return proposal;
  };

  const resolveProposal = async (action, proposalIdOverride = "", manageBusy = true) => {
    const proposalId = proposalIdOverride || currentProposalId;

    if (!token || !currentSessionId || !proposalId) {
      setError("No active proposal to resolve");
      return;
    }

    if (manageBusy) {
      setBusy(true);
    }
    setError("");
    try {
      const resolved = await decideProposal(baseUrl, token, currentSessionId, proposalId, action);
      pushEvent(`${action}:${resolved.target_file}`);
      setReviewTitle(`${action === "approve" ? "Approved" : "Rejected"}: ${resolved.target_file}`);
      setEvents((previous) => [
        `${action}:${resolved.proposal_id}:${resolved.status}`,
        ...previous,
      ].slice(0, MAX_EVENTS));
      setCurrentProposal(null);
      setCurrentProposalId("");
      await refreshMessages(currentSessionId, token);
      await loadProposal(proposalId, token).catch(() => null);
    } catch (proposalError) {
      setError(proposalError.message);
    } finally {
      if (manageBusy) {
        setBusy(false);
      }
    }
  };

  const runPaletteAction = async (action) => {
    if (!action) {
      return;
    }

    setPaletteOpen(false);
    setPaletteDraft("");

    if (action.value === "mode:code") {
      setActiveMode("code");
      pushEvent("Mode switched to code");
      return;
    }

    if (action.value === "mode:chat") {
      setActiveMode("chat");
      pushEvent("Mode switched to chat");
      return;
    }

    if (action.value === "mode:review") {
      setActiveMode("review");
      pushEvent("Mode switched to review");
      return;
    }

    if (action.value === "compact") {
      setReviewTitle("Compact summary");
      setDiffPreview(buildCompactSummary());
      setGitSummary("Session compacted for continuation");
      pushEvent("Context compacted");
      return;
    }

    if (action.value === "ultrareview") {
      setActiveMode("review");
      setReviewTitle("Ultrareview findings");
      setDiffPreview(buildUltrareviewAudit());
      pushEvent("Ultrareview generated");
      return;
    }

    if (action.value === "plan") {
      setDraft("/plan ");
      return;
    }

    if (action.value === "rollback") {
      await handleCommand("/rollback");
      return;
    }

    if (action.value === "loop") {
      setDraft("/loop --verify \"npm test\" --max 3 ");
      return;
    }

    if (action.value === "refresh") {
      await handleCommand("/refresh");
      return;
    }

    if (action.value === "clear") {
      await handleCommand("/clear");
      return;
    }

    if (action.value === "git status") {
      await handleCommand("/git status");
      return;
    }

    if (action.value === "git diff") {
      await handleCommand("/git diff");
      return;
    }

    if (action.value === "run") {
      setDraft("/run ");
      return;
    }

    if (action.value === "approve") {
      await resolveProposal("approve");
      return;
    }

    if (action.value === "reject") {
      await resolveProposal("reject");
    }
  };

  const refreshSessions = async (activeToken = token) => {
    const nextSessions = await listSessions(baseUrl, activeToken);
    setSessions(nextSessions);
    if (!currentSessionId && nextSessions.length > 0) {
      setCurrentSessionId(nextSessions[0].session_id);
    }
    return nextSessions;
  };

  const refreshMessages = async (sessionId = currentSessionId, activeToken = token) => {
    if (!sessionId) {
      setMessages([]);
      return [];
    }

    const nextMessages = await listMessages(baseUrl, activeToken, sessionId);
    setMessages(nextMessages.slice(-MAX_MESSAGES));
    return nextMessages;
  };

  const ensureSession = async (activeToken = token) => {
    if (currentSessionId) {
      return currentSessionId;
    }

    const created = await createSession(baseUrl, activeToken, {
      project_path: projectPath,
      model_preference: DEFAULT_MODEL,
    });

    setCurrentSessionId(created.session_id);
    await refreshSessions(activeToken);
    await refreshMessages(created.session_id, activeToken);
    pushEvent(`Created session ${created.session_id}`);
    return created.session_id;
  };

  const login = async (nextUserId) => {
    setBusy(true);
    setError("");
    try {
      const response = await devLogin(baseUrl, nextUserId);
      setUserId(nextUserId);
      setToken(response.access_token);
      setBootStatus(`Logged in as ${nextUserId}`);
      pushEvent(`Authenticated as ${nextUserId}`);
      const nextSessions = await refreshSessions(response.access_token);
      if (nextSessions.length > 0) {
        setCurrentSessionId(nextSessions[0].session_id);
        await refreshMessages(nextSessions[0].session_id, response.access_token);
      } else {
        setCurrentSessionId("");
        setMessages([]);
      }
    } catch (loginError) {
      setError(loginError.message);
      setBootStatus("Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCommand = async (input) => {
    const command = input.slice(1).trim();
    const [name, ...rest] = command.split(/\s+/);
    const argument = rest.join(" ").trim();

    if (name === "help") {
      pushEvent("Commands: /login <user>, /session [path], /use <n>, /refresh, /clear, /quit, /mode <code|chat|review>, /compact, /ultrareview, /plan <files...>, /plan run <prompt>, /plan show, /rollback, /loop --verify <cmd> [--max <n>] [--prompt <text>], /approve, /reject, /git status | /git diff [path] | /git log [limit] | /git stage [path ...|--all] | /git commit <message> | /git branch <name> | /git worktree list | /git worktree create <branch> | /git merge-assist <branch> | /git resolve-guide <branch> | /git assist-apply <branch> <ours|theirs> [path ...] | /run <command>");
      return;
    }

    if (name === "quit") {
      exit();
      return;
    }

    if (name === "clear") {
      setMessages([]);
      setEvents([]);
      setStreamingAssistant("");
      setReviewTitle("No proposal yet");
      setDiffPreview("");
      setShellPreview("");
      setCurrentProposal(null);
      setCurrentProposalId("");
      setActivePlan(null);
      setLoopState({ running: false, lastSummary: "" });
      return;
    }

    if (name === "mode") {
      const nextMode = (argument || "code").toLowerCase();
      if (!["code", "chat", "review"].includes(nextMode)) {
        setError("Usage: /mode code | chat | review");
        return;
      }

      setActiveMode(nextMode);
      pushEvent(`Mode switched to ${nextMode}`);
      return;
    }

    if (name === "compact") {
      setReviewTitle("Compact summary");
      setDiffPreview(buildCompactSummary());
      setGitSummary("Session compacted for continuation");
      pushEvent("Context compacted");
      return;
    }

    if (name === "ultrareview") {
      setActiveMode("review");
      setReviewTitle("Ultrareview findings");
      setDiffPreview(buildUltrareviewAudit());
      pushEvent("Ultrareview generated");
      return;
    }

    if (name === "plan") {
      try {
        const tokens = splitShellWords(argument).map(stripQuotes);
        if (tokens.length === 0) {
          throw new Error("Usage: /plan <file1> <file2> ... | /plan run <prompt> | /plan show");
        }

        if (tokens[0] === "run") {
          const promptText = argument.slice(argument.indexOf("run") + 3).trim();
          setBusy(true);
          await executeMultiFilePlan(promptText);
          return;
        }

        if (tokens[0] === "show") {
          if (!activePlan) {
            throw new Error("No active plan. Run /plan <files...> first.");
          }
          setReviewTitle(`Multi-file plan ${activePlan.planId}`);
          setDiffPreview([
            `Plan ${activePlan.planId}`,
            `Created: ${activePlan.createdAt}`,
            "Targets:",
            ...activePlan.targets.map((target) => `- ${target}`),
            "",
            `Last execution: ${activePlan.lastExecution ? activePlan.lastExecution.status : "not run"}`,
          ].join("\n"));
          pushEvent(`plan show ${activePlan.planId}`);
          return;
        }

        createMultiFilePlan(tokens);
      } catch (planError) {
        setError(planError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "rollback") {
      try {
        rollbackMultiFilePlan();
      } catch (rollbackError) {
        setError(rollbackError.message);
      }
      return;
    }

    if (name === "loop") {
      if (!token) {
        setError("Login first with /login <userId>");
        return;
      }

      const options = parseLoopCommand(argument);
      if (!options.verifyCommand) {
        setError("Usage: /loop --verify <command> [--max <n>] [--prompt <text>]");
        return;
      }

      setBusy(true);
      setError("");
      try {
        await runLoopWorkflow(options);
      } catch (loopError) {
        setError(loopError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "approve" || name === "reject") {
      await resolveProposal(name);
      return;
    }

    if (name === "login") {
      await login(argument || DEFAULT_USER_ID);
      return;
    }

    if (name === "session") {
      const nextPath = argument || projectPath;
      setProjectPath(nextPath);
      if (!token) {
        await login(userId || DEFAULT_USER_ID);
        return;
      }

      setBusy(true);
      setError("");
      try {
        const created = await createSession(baseUrl, token, {
          project_path: nextPath,
          model_preference: DEFAULT_MODEL,
        });
        setCurrentSessionId(created.session_id);
        await refreshSessions(token);
        await refreshMessages(created.session_id, token);
        pushEvent(`Created session ${created.session_id} for ${nextPath}`);
      } catch (sessionError) {
        setError(sessionError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "use") {
      const index = Number.parseInt(argument, 10) - 1;
      if (Number.isNaN(index) || index < 0 || index >= sessions.length) {
        setError("Usage: /use <session number>");
        return;
      }

      const nextSessionId = sessions[index].session_id;
      setCurrentSessionId(nextSessionId);
      await refreshMessages(nextSessionId, token);
      pushEvent(`Switched to ${nextSessionId}`);
      return;
    }

    if (name === "refresh") {
      if (!token) {
        setError("Login first with /login <userId>");
        return;
      }

      await refreshSessions(token);
      if (currentSessionId) {
        await refreshMessages(currentSessionId, token);
      }
      pushEvent("Refreshed sessions and messages");
      return;
    }

    if (name === "git") {
      if (!token || !currentSessionId) {
        setError("Login and open a session first");
        return;
      }

      const subcommand = rest[0] || "status";
      setBusy(true);
      setError("");
      try {
        if (subcommand === "status") {
          const status = await getGitStatus(baseUrl, token, currentSessionId);
          setGitSummary(`${status.branch} | ${status.summary}`);
          pushEvent(`git:${status.branch}:${status.summary}`);
          if (status.changed_files.length > 0) {
            status.changed_files.slice(0, 3).forEach((item) => pushEvent(`git:${item.status} ${item.path}`));
          }
          if (status.untracked_files.length > 0) {
            status.untracked_files.slice(0, 3).forEach((filePath) => pushEvent(`git:?? ${filePath}`));
          }
        } else if (subcommand === "diff") {
          const diff = await getGitDiff(baseUrl, token, currentSessionId, rest.slice(1).join(" ").trim() || null);
          setReviewTitle(diff.path ? `Git diff: ${diff.path}` : "Git diff: worktree");
          setDiffPreview(diff.diff || diff.stat || "git diff empty");
          pushEvent(diff.stat || "git diff empty");
          if (diff.diff) {
            pushEvent(truncate(diff.diff.replace(/\s+/g, " "), 220));
          }
        } else if (subcommand === "log") {
          const log = await getGitLog(baseUrl, token, currentSessionId, Number.parseInt(rest[1] || "10", 10) || 10);
          log.commits.slice(0, 5).forEach((entry) => pushEvent(`git:${entry.commit_id} ${entry.message}`));
        } else if (subcommand === "stage") {
          const target = rest.slice(1).join(" ").trim();
          const payload = target === "--all" || target === "all"
            ? { all_files: true, paths: [] }
            : { all_files: false, paths: target ? target.split(/\s+/).filter(Boolean) : [] };
          const result = await stageGitFiles(baseUrl, token, currentSessionId, payload);
          pushEvent(`git:staged ${result.paths.join(", ")}`);
          setGitSummary(`staged ${result.paths.length} path(s)`);
        } else if (subcommand === "commit") {
          const message = rest.slice(1).join(" ").trim();
          if (!message) {
            setError("Usage: /git commit <message>");
            return;
          }
          const result = await commitGitChanges(baseUrl, token, currentSessionId, message);
          pushEvent(`git:commit ${result.message}`);
          if (Array.isArray(result.staged_files) && result.staged_files.length > 0) {
            pushEvent(`git:staged in commit ${truncate(result.staged_files.join(", "), 120)}`);
          }
          setGitSummary(`commit created: ${truncate(result.message, 42)}`);
        } else if (subcommand === "branch") {
          const branchName = rest.slice(1).join(" ").trim();
          if (!branchName) {
            setError("Usage: /git branch <name>");
            return;
          }
          const result = await branchGitRepo(baseUrl, token, currentSessionId, { branch: branchName, create: true });
          pushEvent(`git:branch ${result.branch}`);
          setGitSummary(`branch ${result.branch}`);
        } else if (subcommand === "worktree") {
          const worktreeAction = rest[1] || "list";
          if (worktreeAction === "list") {
            const result = await listGitWorktrees(baseUrl, token, currentSessionId);
            result.worktrees.slice(0, 4).forEach((worktree) => {
              pushEvent(`git:worktree ${worktree.branch || "unknown"} ${truncate(worktree.path, 24)}`);
            });
            setGitSummary(`worktrees ${result.worktrees.length}`);
          } else if (worktreeAction === "create") {
            const branchName = rest.slice(2).join(" ").trim();
            if (!branchName) {
              setError("Usage: /git worktree create <branch>");
              return;
            }
            const result = await createGitWorktree(baseUrl, token, currentSessionId, branchName);
            pushEvent(`git:worktree ${result.branch} ${truncate(result.path, 24)}`);
            setGitSummary(`worktree ${result.branch}`);
          } else {
            setError("Usage: /git worktree list | /git worktree create <branch>");
          }
        } else if (subcommand === "merge-assist") {
          const targetBranch = rest.slice(1).join(" ").trim();
          if (!targetBranch) {
            setError("Usage: /git merge-assist <branch>");
            return;
          }
          const result = await getGitMergeAssist(baseUrl, token, currentSessionId, targetBranch);
          pushEvent(`git:merge ${result.current_branch} -> ${result.target_branch}`);
          pushEvent(`git:base ${result.base_branch} | ${result.ahead_behind}`);
          pushEvent(`git:risk ${result.risk_level} | auto-merge ${result.can_auto_merge ? "yes" : "no"}`);
          if (result.conflicts) {
            pushEvent(truncate(`conflicts: ${result.conflict_preview || "potential conflicts detected"}`, 220));
            if (Array.isArray(result.conflict_files) && result.conflict_files.length > 0) {
              pushEvent(`conflict files: ${truncate(result.conflict_files.join(", "), 160)}`);
            }
          }
          if (Array.isArray(result.safety_recommendations)) {
            result.safety_recommendations.slice(0, 3).forEach((recommendation) => {
              pushEvent(`safety: ${truncate(recommendation, 180)}`);
            });
          }
          setReviewTitle(`Merge assist: ${result.current_branch} -> ${result.target_branch}`);
          setDiffPreview(result.merge_preview || result.stat || "merge preview unavailable");
          setGitSummary(`merge ${result.current_branch}...${result.target_branch}`);
        } else if (subcommand === "resolve-guide") {
          const targetBranch = rest.slice(1).join(" ").trim();
          if (!targetBranch) {
            setError("Usage: /git resolve-guide <branch>");
            return;
          }
          const guide = await getGitConflictGuide(baseUrl, token, currentSessionId, targetBranch);
          pushEvent(`git:resolve ${guide.current_branch} -> ${guide.target_branch}`);
          pushEvent(`git:conflicts ${guide.has_conflicts ? "detected" : "none detected"}`);
          guide.notes.slice(0, 3).forEach((note) => pushEvent(`note: ${truncate(note, 180)}`));
          guide.steps.slice(0, 6).forEach((step, index) => {
            pushEvent(`step ${index + 1}: ${truncate(step.title, 120)}`);
          });

          const guideText = guide.steps
            .map((step, index) => `${index + 1}. ${step.title}\n   ${step.command}\n   why: ${step.reason}`)
            .join("\n\n");
          setReviewTitle(`Conflict guide: ${guide.current_branch} -> ${guide.target_branch}`);
          setDiffPreview(guideText || "No guide steps available");
          setGitSummary(`resolve guide ${guide.target_branch}`);
        } else if (subcommand === "assist-apply") {
          const targetBranch = (rest[1] || "").trim();
          const strategy = (rest[2] || "").trim().toLowerCase();
          const selectedPaths = rest.slice(3).map((item) => item.trim()).filter(Boolean);

          if (!targetBranch || !strategy) {
            setError("Usage: /git assist-apply <branch> <ours|theirs> [path ...]");
            return;
          }

          if (!["ours", "theirs"].includes(strategy)) {
            setError("Strategy must be ours or theirs");
            return;
          }

          const result = await applyGitConflictAssist(baseUrl, token, currentSessionId, {
            target_branch: targetBranch,
            strategy,
            paths: selectedPaths,
          });

          pushEvent(`git:assist ${result.current_branch} -> ${result.target_branch} (${result.strategy})`);
          pushEvent(`git:applied ${Array.isArray(result.applied_paths) ? result.applied_paths.length : 0} file(s)`);
          pushEvent(`git:remaining ${Array.isArray(result.remaining_conflicts) ? result.remaining_conflicts.length : 0} conflict(s)`);
          if (Array.isArray(result.remaining_conflicts) && result.remaining_conflicts.length > 0) {
            pushEvent(`conflicts left: ${truncate(result.remaining_conflicts.join(", "), 180)}`);
          }
          if (Array.isArray(result.next_steps)) {
            result.next_steps.slice(0, 3).forEach((step) => pushEvent(`next: ${truncate(step, 180)}`));
          }

          const preview = [
            `Conflict assisted apply: ${result.current_branch} -> ${result.target_branch}`,
            `Strategy: ${result.strategy}`,
            `Applied paths (${result.applied_paths.length}): ${result.applied_paths.join(", ") || "none"}`,
            `Remaining conflicts (${result.remaining_conflicts.length}): ${result.remaining_conflicts.join(", ") || "none"}`,
            "",
            "Next steps:",
            ...(result.next_steps || []).map((step, index) => `${index + 1}. ${step}`),
          ].join("\n");

          setReviewTitle(`Conflict assist: ${result.strategy}`);
          setDiffPreview(preview);
          setGitSummary(`assist apply ${result.strategy} | remaining ${result.remaining_conflicts.length}`);
        } else {
          setError("Usage: /git status | /git diff [path] | /git log [limit] | /git stage [path ...|--all] | /git commit <message> | /git branch <name> | /git worktree list | /git worktree create <branch> | /git merge-assist <branch> | /git resolve-guide <branch> | /git assist-apply <branch> <ours|theirs> [path ...]");
        }
      } catch (gitError) {
        setError(gitError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "run" || name === "shell") {
      if (!token || !currentSessionId) {
        setError("Login and open a session first");
        return;
      }

      if (!argument) {
        setError("Usage: /run <command>");
        return;
      }

      setBusy(true);
      setError("");
      try {
        pushEvent(`shell> ${argument}`);
        setReviewTitle(`Shell: ${argument}`);
        setShellPreview(`Running in ${projectPath}`);
        for await (const event of streamShellCommand(baseUrl, token, currentSessionId, {
          command: argument,
          timeout_seconds: 30,
        })) {
          if (event.type === "shell_call") {
            setShellPreview(`cwd ${truncate(event.payload?.cwd || projectPath, 42)} | ${truncate(event.payload?.command || argument, 60)}`);
          }

          if (event.type === "shell_output") {
            setShellPreview(event.payload?.content || shellPreview);
          }

          if (event.type === "shell_result") {
            setShellPreview(`exit ${event.payload?.exit_code ?? "unknown"} | ${event.payload?.output_lines ?? 0} line(s)`);
          }

          pushEvent(formatEvent(event));
        }
      } catch (shellError) {
        setError(shellError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    setError(`Unknown command: ${name}`);
  };

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || busy) {
      return;
    }

    setDraft("");

    if (trimmed.startsWith("/")) {
      await handleCommand(trimmed);
      return;
    }

    if (!token) {
      setError("Login first with /login <userId>");
      return;
    }

    setBusy(true);
    setError("");
    setStreamingAssistant("");
    try {
      const sessionId = await ensureSession(token);
      setMessages((previous) => [
        ...previous,
        {
          id: `local_${Date.now()}`,
          role: "user",
          content: trimmed,
        },
      ].slice(-MAX_MESSAGES));

      const created = await sendMessage(baseUrl, token, sessionId, {
        content: trimmed,
        context: {
          workspace_path: projectPath,
          selection: null,
          active_file: null,
        },
      });

      pushEvent(`Model: ${created.model_used} | ${created.intent} | ${created.routing_reason}`);
      pushEvent(`est. cost INR ${created.estimated_cost}`);

      let assistantText = "";
      for await (const event of streamSessionEvents(baseUrl, token, sessionId)) {
        if (event.type === "token") {
          assistantText += event.content || "";
          setStreamingAssistant(assistantText);
          continue;
        }

        pushEvent(formatEvent(event));

        if (event.type === "run_started" && event.payload?.proposal_id) {
          pushEvent(`proposal:${event.payload.proposal_id}`);
          setReviewTitle(`Proposal ${event.payload.proposal_id}`);
          setCurrentProposalId(event.payload.proposal_id);
          loadProposal(event.payload.proposal_id, token).catch(() => null);
        }

        if (event.type === "complete") {
          const proposalSuffix = event.payload?.proposal_id ? ` | proposal ${event.payload.proposal_id}` : "";
          pushEvent(`Completed in ${event.payload?.output_tokens || event.tokens || 0} tokens${proposalSuffix}`);
        }

        if (event.type === "diff") {
          setReviewTitle(`Proposal: ${event.payload?.file || "unknown file"}`);
          setDiffPreview(event.payload?.patch || event.payload?.file || "");
          if (event.payload?.proposal_id) {
            setCurrentProposalId(event.payload.proposal_id);
            loadProposal(event.payload.proposal_id, token).catch(() => null);
          }
        }

        if (event.type === "approval_request") {
          setReviewTitle(event.payload?.message || "Review requested");
          if (event.payload?.proposal_id) {
            setCurrentProposalId(event.payload.proposal_id);
            loadProposal(event.payload.proposal_id, token).catch(() => null);
          }
        }
      }

      setStreamingAssistant("");
      await refreshMessages(sessionId, token);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    pushEvent(`Base URL ${baseUrl}`);
    pushEvent(`Type /login ${DEFAULT_USER_ID} to start`);
  }, []);

  useInput(async (input, key) => {
    if (paletteOpen) {
      if (key.escape) {
        setPaletteOpen(false);
        setPaletteDraft("");
        return;
      }

      if (key.backspace || key.delete) {
        setPaletteDraft((previous) => previous.slice(0, -1));
        return;
      }

      if (key.return) {
        await runPaletteAction(findPaletteAction(paletteDraft));
        return;
      }

      if (input) {
        setPaletteDraft((previous) => previous + input);
      }

      return;
    }

    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (key.ctrl && input === "p") {
      setPaletteOpen(true);
      setPaletteDraft("");
      return;
    }

    if (!draft && key.tab) {
      cyclePane(key.shift ? -1 : 1);
      return;
    }

    if (!draft && key.leftArrow) {
      cycleMode(-1);
      return;
    }

    if (!draft && key.rightArrow) {
      cycleMode(1);
      return;
    }

    if (!draft && key.upArrow) {
      await selectSessionByDelta(-1);
      return;
    }

    if (!draft && key.downArrow) {
      await selectSessionByDelta(1);
      return;
    }

    if (activeMode === "review" && key.ctrl && input === "y") {
      await resolveProposal("approve");
      return;
    }

    if (activeMode === "review" && key.ctrl && input === "n") {
      await resolveProposal("reject");
      return;
    }

    if (activeMode === "review" && key.ctrl && input === "o") {
      if (currentProposal) {
        pushEvent(`Reviewing ${currentProposal.target_file}`);
      }
      return;
    }

    if (key.ctrl && input === "r") {
      await handleCommand("/refresh");
      return;
    }

    if (key.return) {
      await handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setDraft((previous) => previous.slice(0, -1));
      return;
    }

    if (key.ctrl && input === "l") {
      setMessages([]);
      setEvents([]);
      setError("");
      return;
    }

    if (key.ctrl && input === "k") {
      setReviewTitle("Compact summary");
      setDiffPreview(buildCompactSummary());
      setGitSummary("Session compacted for continuation");
      pushEvent("Context compacted");
      return;
    }

    if (key.ctrl && key.shift && input === "u") {
      setActiveMode("review");
      setReviewTitle("Ultrareview findings");
      setDiffPreview(buildUltrareviewAudit());
      pushEvent("Ultrareview generated");
      return;
    }

    if (input) {
      setDraft((previous) => previous + input);
    }
  });

  const sessionLines = sessions.length
    ? sessions.map((session, index) => {
        const isActive = session.session_id === currentSessionId;
        return `${isActive ? ">" : " "} ${index + 1}. ${truncate(session.session_id, 12)} | ${truncate(session.project_path, 18)}`;
      })
    : ["No sessions yet."];

  const chatLines = messages.length
    ? messages.map((message) => `${message.role === "user" ? "You" : "CodeForge"}: ${message.content}`)
    : ["No messages yet."];

  if (streamingAssistant) {
    chatLines.push(`CodeForge: ${streamingAssistant}`);
  }

  const eventLines = events.length ? events : ["Waiting for activity..."];
  const treeLines = buildFileTree(projectPath);
  const diffLines = splitPreview(diffPreview || gitSummary, MAX_DIFF_LINES);
  const reviewLines = [reviewTitle, ...diffLines].slice(0, MAX_DIFF_LINES + 1);
  const shellLines = shellPreview ? shellPreview.split("\n").slice(0, 4) : ["No shell output yet."];
  const paletteHint = paletteOpen ? (findPaletteAction(paletteDraft)?.label || "Type to filter actions") : `Mode: ${activeMode}`;
  const shortcutHint = getModeHint(activeMode);
  const paneLabel = activePane ? `Focus: ${activePane}` : "Focus: none";

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text color="cyanBright" bold>
          CodeForge Terminal
        </Text>
        <Text dimColor>
          {bootStatus} | {busy ? "Busy" : "Ready"} | {userId || "anonymous"} | {currentSession ? currentSession.session_id : "no session"} | {paneLabel} | {paletteHint}
        </Text>
      </Box>
      <Text dimColor>
        {baseUrl} | model {DEFAULT_MODEL} | project {truncate(projectPath, 36)}
      </Text>
      <Text dimColor>{shortcutHint}</Text>
      <Newline />
      <Box>
        <Box borderStyle="single" borderColor={activePane === "files" ? "cyan" : undefined} flexDirection="column" width={24} paddingX={1} marginRight={1}>
          <Text bold>Files</Text>
          {treeLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Box>
        <Box borderStyle="single" borderColor={activePane === "sessions" ? "cyan" : undefined} flexDirection="column" width={24} paddingX={1} marginRight={1}>
          <Text bold>Sessions</Text>
          {sessionLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Box>
        <Box borderStyle="single" borderColor={activePane === "chat" ? "cyan" : undefined} flexDirection="column" flexGrow={1} minWidth={30} paddingX={1} marginRight={1}>
          <Text bold>Chat</Text>
          {chatLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Box>
        <Box borderStyle="single" borderColor={activePane === "review" ? "cyan" : undefined} flexDirection="column" width={42} paddingX={1} marginRight={1}>
          <Text bold>Diff / Review</Text>
          {reviewLines.map((line, index) => (
            <Text key={`${index}-${line}`}>{line}</Text>
          ))}
        </Box>
        <Box borderStyle="single" borderColor={activePane === "activity" ? "cyan" : undefined} flexDirection="column" width={34} paddingX={1}>
          <Text bold>Activity</Text>
          {shellLines.map((line, index) => (
            <Text key={`${index}-${line}`}>{line}</Text>
          ))}
          {eventLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
          {error ? <Text color="red">{error}</Text> : null}
        </Box>
      </Box>
      <Newline />
      {paletteOpen ? (
        <Box borderStyle="single" paddingX={1} marginBottom={1}>
          <Text color="yellow">Palette</Text>
          <Text>{`: ${paletteDraft || "type to search"}`}</Text>
          <Text dimColor>
            {PALETTE_ACTIONS.map((action) => action.label).join(" | ")}
          </Text>
        </Box>
      ) : null}
      <Box borderStyle="single" paddingX={1}>
        <Text color="green">&gt; </Text>
        <Text>{draft || "Type a prompt or /help"}</Text>
      </Box>
      <Text dimColor>
        Commands: Tab pane focus | Ctrl+P palette | Ctrl+K compact | Ctrl+Shift+U ultrareview | /login &lt;user&gt; | /session [path] | /use &lt;n&gt; | /refresh | /clear | /quit | /mode code|chat|review | /compact | /ultrareview | /plan &lt;files...&gt; | /plan run &lt;prompt&gt; | /plan show | /rollback | /loop --verify &lt;cmd&gt; [--max n] [--prompt text] | /approve | /reject | /git status | /git diff [path] | /git log [limit] | /git resolve-guide &lt;branch&gt; | /git assist-apply &lt;branch&gt; &lt;ours|theirs&gt; [path ...] | /run &lt;command&gt;
      </Text>
    </Box>
  );
}

render(<App />);
