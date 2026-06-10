import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, Newline, render, useApp, useInput } from "ink";
import fs from "node:fs";
import path from "node:path";
import {
  composeAgentTemplate,
  createSession,
  forkSession,
  listAgentTemplates,
  listSessionArtifacts,
  applyGitConflictAssist,
  branchGitRepo,
  commitGitChanges,
  decideProposal,
  completeOidcCallback,
  createTeamStyleGuide,
  devLogin,
  getGitDiff,
  getOidcAuthorizeUrl,
  getOidcConfig,
  getGitConflictGuide,
  getGitLog,
  getGitMergeAssist,
  getGitStatus,
  getProposal,
  listMessages,
  listSessions,
  listGitWorktrees,
  compactWorkflow,
  createCoworkJob,
  createCoworkPlan,
  createRemoteChannel,
  createSessionShare,
  approveTeamDelegationStep,
  createTeamDelegation,
  createTeamWorkspace,
  createWorkspaceSessionGrant,
  addTeamWorkspaceMember,
  executeTeamDelegation,
  listTeamStyleGuides,
  updateTeamStyleGuide,
  streamTeamEvents,
  exportSession,
  extractCoworkData,
  listCoworkJobs,
  listCoworkPlans,
  listCoworkRuns,
  listRemoteChannels,
  listTeamAuditLog,
  listTeamDelegations,
  listTeamWorkspaces,
  listWorkspaceSessionGrants,
  pairRemoteChannel,
  pushRemoteChannelEvent,
  queryProjectKnowledge,
  rebuildProjectKnowledge,
  runAgentLoop,
  runCoworkPlan,
  toggleCoworkJob,
  sendMessage,
  ultrareviewWorkflow,
  stageGitFiles,
  createGitWorktree,
  streamSessionEvents,
  streamShellCommand,
} from "@codeforge/shared/api";
import { formatEvent } from "@codeforge/shared/sse";
import { canWriteSession, formatSessionListLabel, viewOnlySessionMessage } from "@codeforge/shared/sessions";
import { inkTheme, paneBorderColor } from "./inkTheme.js";

const DEFAULT_BASE_URL = process.env.CODEFORGE_API_BASE_URL || "http://127.0.0.1:8000";
const TERMINAL_OIDC_REDIRECT_URI =
  process.env.CODEFORGE_OIDC_REDIRECT_URI || "http://127.0.0.1:4583/auth/callback";
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

const PALETTE_CATEGORIES = [
  {
    label: "Navigation",
    actions: [
      { label: "Mode: Code", value: "mode:code" },
      { label: "Mode: Chat", value: "mode:chat" },
      { label: "Mode: Review", value: "mode:review" },
      { label: "Refresh", value: "refresh" },
      { label: "Clear workspace", value: "clear" },
    ],
  },
  {
    label: "Workflows",
    actions: [
      { label: "Compact context", value: "compact" },
      { label: "Ultra review", value: "ultrareview" },
      { label: "Plan files", value: "plan" },
      { label: "Rollback plan", value: "rollback" },
      { label: "Loop verify", value: "loop" },
      { label: "Fork session", value: "fork" },
      { label: "Toggle auto mode", value: "auto" },
    ],
  },
  {
    label: "Team & Cowork",
    actions: [
      { label: "Team workspaces", value: "team:workspaces" },
      { label: "Cowork plans", value: "cowork:plans" },
      { label: "List artifacts", value: "artifacts" },
      { label: "List templates", value: "template:list" },
    ],
  },
  {
    label: "Git & Shell",
    actions: [
      { label: "Git status", value: "git status" },
      { label: "Git diff", value: "git diff" },
      { label: "Run shell", value: "run" },
      { label: "Approve proposal", value: "approve" },
      { label: "Reject proposal", value: "reject" },
    ],
  },
];

const PALETTE_ACTIONS = PALETTE_CATEGORIES.flatMap((category) => category.actions);

function truncate(text, limit) {
  if (!text) {
    return "";
  }

  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function formatRoutingSignal(signal) {
  if (!signal) {
    return "Routing: awaiting prompt";
  }

  const confidence = `${signal.confidence_label || "unknown"} ${Math.round((signal.confidence_score || 0) * 100)}%`;
  const review = signal.review_required ? " | review required" : "";
  const tier = signal.routing_tier ? ` | tier ${signal.routing_tier}` : "";
  const fallback = signal.fallback_used ? " | fallback path" : "";
  return `Routing: ${signal.intent || "unknown"} via ${signal.model_used || "unknown"} | confidence ${confidence}${review}${tier}${fallback}`;
}

function routingSignalFromPayload(payload = {}) {
  return {
    intent: payload.intent,
    model_used: payload.model,
    confidence_score: payload.confidence_score,
    confidence_label: payload.confidence_label,
    review_required: Boolean(payload.review_required),
    routing_tier: payload.routing_tier,
    fallback_used: Boolean(payload.fallback_used),
  };
}

function routingSignalFromMessageResponse(response = {}) {
  return {
    intent: response.intent,
    model_used: response.model_used,
    confidence_score: response.confidence_score,
    confidence_label: response.confidence_label,
    review_required: Boolean(response.review_required),
    routing_tier: response.routing_tier,
    fallback_used: Boolean(response.fallback_used),
  };
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
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const loginFirstMessage = () =>
    oidcEnabled ? "Login first with /sso" : "Login first with /login <userId>";
  const oidcPendingRef = useRef(null);
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
  const [autoMode, setAutoMode] = useState(false);
  const [routingSignal, setRoutingSignal] = useState(null);
  const [error, setError] = useState("");

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === currentSessionId) || null,
    [currentSessionId, sessions],
  );

  const pushEvent = (line) => {
    setEvents((previous) => [line, ...previous].slice(0, MAX_EVENTS));
  };

  const assertWritableSession = (session = currentSession) => {
    if (!canWriteSession(session)) {
      throw new Error("This session is view-only (granted read access).");
    }
  };

  const runAgentTurn = async (sessionId, prompt) => {
    assertWritableSession();
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
    let reviewRequired = false;

    for await (const event of streamSessionEvents(baseUrl, token, sessionId)) {
      if (event.type === "token") {
        assistantText += event.content || "";
        setStreamingAssistant(assistantText);
        continue;
      }

      pushEvent(formatEvent(event));

      if (event.type === "run_started") {
        setRoutingSignal(routingSignalFromPayload(event.payload));
        reviewRequired = Boolean(event.payload?.review_required);
        if (event.payload?.proposal_id) {
          proposalId = event.payload.proposal_id;
        }
      }

      if (event.type === "complete") {
        setRoutingSignal((previous) => ({
          ...(previous || {}),
          ...routingSignalFromPayload(event.payload),
        }));
        reviewRequired = Boolean(event.payload?.review_required ?? reviewRequired);
        if (event.payload?.artifact_ids?.length) {
          pushEvent(`artifacts: ${event.payload.artifact_ids.join(", ")}`);
        }
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

    return { proposalId, reviewRequired };
  };

  const runLoopWorkflow = async ({ verifyCommand, prompt, maxAttempts }) => {
    const sessionId = await ensureSession(token);
    const verifyLabel = verifyCommand || "npm test";
    const fixedPrompt = prompt || "Fix the failing verification command and propose minimal changes.";

    setLoopState({ running: true, lastSummary: "loop running" });
    setReviewTitle("Loop workflow");
    setDiffPreview(`verify: ${verifyLabel}\nmax attempts: ${maxAttempts}`);

    try {
      pushEvent("loop: backend verify/fix");
      const result = await runAgentLoop(baseUrl, token, sessionId, {
        verify_command: verifyLabel,
        prompt: fixedPrompt,
        max_attempts: maxAttempts,
        auto_apply: true,
        auto_mode: autoMode,
      });

      const attemptLines = result.attempts.map((item) => {
        const applied = item.applied ? " | applied" : "";
        const patch = item.patch_source ? ` | patch: ${item.patch_source}` : "";
        return `attempt ${item.attempt}: exit ${item.verify_exit_code}${applied}${patch}`;
      });

      const summary = result.passed ? result.message : `Loop failed: ${result.message}`;
      setLoopState({ running: false, lastSummary: summary });
      setReviewTitle("Loop workflow result");
      setDiffPreview([summary, ...attemptLines].join("\n"));
      pushEvent(summary);

      const lastWithProposal = [...result.attempts].reverse().find((item) => item.proposal_id);
      if (lastWithProposal?.proposal_id) {
        setCurrentProposalId(lastWithProposal.proposal_id);
        await loadProposal(lastWithProposal.proposal_id, token).catch(() => null);
      }

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

        if (autoMode && turn.reviewRequired) {
          throw new Error(`Auto mode blocked apply for ${target} (review required)`);
        }

        if (autoMode && !turn.reviewRequired) {
          await resolveProposal("approve", turn.proposalId, false);
          applied.push({ target, proposalId: turn.proposalId });
          pushEvent(`plan applied ${target}`);
        } else {
          setCurrentProposalId(turn.proposalId);
          throw new Error(`Manual approval required for ${target}. Review and run /approve.`);
        }
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
      `Session: ${currentSession ? formatSessionListLabel(currentSession) : currentSessionId || "none"}`,
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

    if (action === "approve") {
      assertWritableSession();
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

    if (action.value === "team:workspaces") {
      await handleCommand("/team workspaces");
      return;
    }

    if (action.value === "cowork:plans") {
      await handleCommand("/cowork plans");
      return;
    }

    if (action.value === "fork") {
      await handleCommand("/fork");
      return;
    }

    if (action.value === "auto") {
      await handleCommand("/auto");
      return;
    }

    if (action.value === "artifacts") {
      await handleCommand("/artifacts");
      return;
    }

    if (action.value === "template:list") {
      await handleCommand("/template list");
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
    if (oidcEnabled) {
      setError("Dev login is disabled — use /sso to sign in");
      return;
    }
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

  const beginOidcLogin = async () => {
    setBusy(true);
    setError("");
    try {
      const config = await getOidcConfig(baseUrl);
      if (!config.enabled) {
        throw new Error("OIDC is not enabled on this API");
      }
      const state = `cf_${Math.random().toString(36).slice(2, 14)}`;
      const result = await getOidcAuthorizeUrl(baseUrl, TERMINAL_OIDC_REDIRECT_URI, state);
      oidcPendingRef.current = {
        state: result.state || state,
        redirectUri: result.redirect_uri || TERMINAL_OIDC_REDIRECT_URI,
      };
      setReviewTitle("OIDC sign-in");
      setDiffPreview(
        [
          "Open this URL in your browser:",
          result.authorize_url,
          "",
          `After redirect, copy the code query param and run:`,
          `/sso complete <code>`,
          "",
          `Redirect URI: ${oidcPendingRef.current.redirectUri}`,
        ].join("\n"),
      );
      setBootStatus("OIDC sign-in started");
      pushEvent("OIDC: open authorize URL in browser");
    } catch (oidcError) {
      setError(oidcError.message);
      setBootStatus("OIDC sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const completeOidcLogin = async (code, stateOverride = "") => {
    const pending = oidcPendingRef.current;
    if (!pending) {
      throw new Error("Start OIDC first with /sso or /login oidc");
    }
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      throw new Error("Usage: /sso complete <authorization_code>");
    }
    setBusy(true);
    setError("");
    try {
      const response = await completeOidcCallback(baseUrl, {
        code: trimmedCode,
        state: stateOverride || pending.state,
        redirect_uri: pending.redirectUri,
      });
      const accessToken = response.access_token;
      const resolvedUserId = accessToken.startsWith("oidc_") ? accessToken.slice(5) : accessToken;
      setUserId(resolvedUserId);
      setToken(accessToken);
      oidcPendingRef.current = null;
      setBootStatus(`Signed in as ${resolvedUserId}`);
      pushEvent(`OIDC authenticated as ${resolvedUserId}`);
      const nextSessions = await refreshSessions(accessToken);
      if (nextSessions.length > 0) {
        setCurrentSessionId(nextSessions[0].session_id);
        await refreshMessages(nextSessions[0].session_id, accessToken);
      }
    } catch (oidcError) {
      setError(oidcError.message);
      setBootStatus("OIDC sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCommand = async (input) => {
    const command = input.slice(1).trim();
    const [name, ...rest] = command.split(/\s+/);
    const argument = rest.join(" ").trim();

    if (name === "help") {
      pushEvent("Commands: /fork, /auto on|off|toggle, /artifacts [preview <id>], /template list|run <id> <task>, /login <user>, /session [path], /use <n>, /refresh, /clear, /quit, /mode <code|chat|review>, /compact, /ultrareview, /plan <files...>, /plan run <prompt>, /plan show, /rollback, /loop --verify <cmd> [--max <n>] [--prompt <text>], /team ..., /cowork ..., /approve, /reject, /git ... | /run <command>");
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
      if (token && currentSessionId) {
        setBusy(true);
        try {
          assertWritableSession();
          const sessionId = await ensureSession(token);
          const result = await compactWorkflow(baseUrl, token, sessionId);
          setReviewTitle("Compact summary");
          setDiffPreview(result.summary);
          setGitSummary("Session compacted for continuation");
          pushEvent("Context compacted (backend)");
        } catch (compactError) {
          setReviewTitle("Compact summary");
          setDiffPreview(buildCompactSummary());
          pushEvent(`compact fallback: ${compactError.message}`);
        } finally {
          setBusy(false);
        }
      } else {
        setReviewTitle("Compact summary");
        setDiffPreview(buildCompactSummary());
        setGitSummary("Session compacted for continuation");
        pushEvent("Context compacted");
      }
      return;
    }

    if (name === "ultrareview") {
      setActiveMode("review");
      if (token && currentSessionId) {
        setBusy(true);
        try {
          assertWritableSession();
          const sessionId = await ensureSession(token);
          const result = await ultrareviewWorkflow(baseUrl, token, sessionId, {});
          setReviewTitle(`Ultrareview (${result.risk_level})`);
          setDiffPreview(result.report);
          pushEvent("Ultrareview generated (backend)");
        } catch (auditError) {
          setReviewTitle("Ultrareview findings");
          setDiffPreview(buildUltrareviewAudit());
          pushEvent(`ultrareview fallback: ${auditError.message}`);
        } finally {
          setBusy(false);
        }
      } else {
        setReviewTitle("Ultrareview findings");
        setDiffPreview(buildUltrareviewAudit());
        pushEvent("Ultrareview generated");
      }
      return;
    }

    if (name === "plan") {
      try {
        const tokens = splitShellWords(argument).map(stripQuotes);
        if (tokens.length === 0) {
          throw new Error("Usage: /plan <file1> <file2> ... | /plan run <prompt> | /plan show");
        }

        if (tokens[0] !== "show") {
          assertWritableSession();
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
        assertWritableSession();
        rollbackMultiFilePlan();
      } catch (rollbackError) {
        setError(rollbackError.message);
      }
      return;
    }

    if (name === "loop") {
      if (!token) {
        setError(loginFirstMessage());
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
        assertWritableSession();
        await runLoopWorkflow(options);
      } catch (loopError) {
        setError(loopError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "fork") {
      if (!token || !currentSessionId) {
        setError("Login and select a session before forking");
        return;
      }
      setBusy(true);
      setError("");
      try {
        assertWritableSession();
        const parentSessionId = currentSessionId;
        const forked = await forkSession(baseUrl, token, parentSessionId);
        setCurrentSessionId(forked.session_id);
        await refreshSessions(token);
        pushEvent(`fork:${forked.session_id}`);
        setReviewTitle("Forked session");
        setDiffPreview(`Parallel session ${forked.session_id} created from ${parentSessionId}`);
      } catch (forkError) {
        setError(forkError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "auto") {
      const mode = (rest[0] || "toggle").toLowerCase();
      let nextMode = autoMode;
      if (mode === "on") {
        nextMode = true;
      } else if (mode === "off") {
        nextMode = false;
      } else {
        nextMode = !autoMode;
      }
      setAutoMode(nextMode);
      pushEvent(`auto mode: ${nextMode ? "on" : "off"}`);
      return;
    }

    if (name === "artifacts") {
      if (!token || !currentSessionId) {
        setError("Login and select a session first");
        return;
      }
      setBusy(true);
      setError("");
      try {
        const sub = (rest[0] || "list").toLowerCase();
        if (sub === "preview" && rest[1]) {
          const previewUrl = `${baseUrl.replace(/\/+$/, "")}/api/v1/sessions/${currentSessionId}/artifacts/${rest[1]}/preview`;
          setReviewTitle(`Artifact preview ${rest[1]}`);
          setDiffPreview(`Open in browser:\n${previewUrl}`);
          pushEvent(`artifact preview:${rest[1]}`);
        } else {
          const result = await listSessionArtifacts(baseUrl, token, currentSessionId);
          const lines = (result.artifacts || []).map(
            (item) => `${item.artifact_id}: ${item.title} (${item.kind})`,
          );
          setReviewTitle("Session artifacts");
          setDiffPreview(lines.length ? lines.join("\n") : "No artifacts yet.");
          pushEvent(`artifacts: ${lines.length}`);
        }
      } catch (artifactError) {
        setError(artifactError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "template") {
      if (!token) {
        setError(loginFirstMessage());
        return;
      }
      setBusy(true);
      setError("");
      try {
        const sub = (rest[0] || "list").toLowerCase();
        if (sub === "list") {
          const result = await listAgentTemplates(baseUrl, token);
          const lines = (result.templates || []).map(
            (item) => `${item.template_id}: ${item.name}`,
          );
          setReviewTitle("Agent templates");
          setDiffPreview(lines.length ? lines.join("\n") : "No templates yet.");
          pushEvent(`templates: ${lines.length}`);
        } else if (sub === "run") {
          const templateId = rest[1];
          const userTask = rest.slice(2).join(" ").trim();
          if (!templateId || !userTask) {
            throw new Error("Usage: /template run <template_id> <task>");
          }
          const composed = await composeAgentTemplate(baseUrl, token, templateId, userTask);
          const sessionId = await ensureSession(token);
          setDraft(composed.composed_prompt);
          pushEvent(`template run:${templateId}`);
          await runAgentTurn(sessionId, composed.composed_prompt);
          if (composed.verify_command) {
            pushEvent(`template verify:${composed.verify_command}`);
          }
          await refreshMessages(sessionId, token);
        } else {
          throw new Error("Usage: /template list | /template run <template_id> <task>");
        }
      } catch (templateError) {
        setError(templateError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "team") {
      if (!token) {
        setError(loginFirstMessage());
        return;
      }

      setBusy(true);
      setError("");
      try {
        const sessionId = await ensureSession(token);
        const sub = (rest[0] || "workspaces").toLowerCase();
        const subArg = rest.slice(1).join(" ").trim();

        if (sub === "workspaces") {
          const result = await listTeamWorkspaces(baseUrl, token);
          const lines = (result.workspaces || []).map(
            (workspace) => `${workspace.workspace_id}: ${workspace.name} (${workspace.members?.length || 0} members)`,
          );
          setReviewTitle("Team workspaces");
          setDiffPreview(lines.length ? lines.join("\n") : "No workspaces yet.");
          pushEvent(`team: ${lines.length} workspace(s)`);
        } else if (sub === "create") {
          if (!subArg) {
            throw new Error("Usage: /team create <name>");
          }
          const workspace = await createTeamWorkspace(baseUrl, token, {
            name: subArg,
            description: "Created from terminal",
          });
          setReviewTitle("Team workspace created");
          setDiffPreview(`${workspace.workspace_id}: ${workspace.name}`);
          pushEvent(`team: created ${workspace.workspace_id}`);
        } else if (sub === "kb" || sub === "knowledge") {
          const kb = await rebuildProjectKnowledge(baseUrl, token, {
            session_id: sessionId,
            title: subArg || "Terminal knowledge index",
          });
          setReviewTitle("Project knowledge");
          setDiffPreview(kb.summary || "Knowledge rebuilt");
          pushEvent(`team: kb ${kb.knowledge_id}`);
        } else if (sub === "query") {
          if (!subArg) {
            throw new Error("Usage: /team query <search text>");
          }
          const result = await queryProjectKnowledge(baseUrl, token, {
            session_id: sessionId,
            query: subArg,
            limit: 6,
          });
          const lines = (result.results || []).map((item) => `${item.path}: ${item.excerpt}`);
          setReviewTitle(`Knowledge query: ${subArg}`);
          setDiffPreview(lines.length ? lines.join("\n\n") : "No matches.");
          pushEvent(`team: query ${lines.length} hit(s)`);
        } else if (sub === "delegations") {
          const workspaceId = subArg || null;
          const result = await listTeamDelegations(baseUrl, token, workspaceId);
          const lines = (result.delegations || []).map(
            (item) => `${item.task_id}: ${item.assigned_role} — ${item.status} — ${item.task}`,
          );
          setReviewTitle("Team delegations");
          setDiffPreview(lines.length ? lines.join("\n") : "No delegations yet.");
          pushEvent(`team: ${lines.length} delegation(s)`);
        } else if (sub === "delegate") {
          const tokens = splitShellWords(subArg).map(stripQuotes);
          const flags = {
            mode: "sequential",
            roles: [],
            requireApproval: false,
          };
          const positional = [];
          for (let index = 0; index < tokens.length; index += 1) {
            const entry = tokens[index];
            if (entry === "--require-approval") {
              flags.requireApproval = true;
              continue;
            }
            if (entry === "--mode" && tokens[index + 1]) {
              flags.mode = tokens[index + 1];
              index += 1;
              continue;
            }
            if (entry === "--roles" && tokens[index + 1]) {
              flags.roles = tokens[index + 1]
                .split(",")
                .map((role) => role.trim())
                .filter(Boolean);
              index += 1;
              continue;
            }
            positional.push(entry);
          }
          const workspaceId = positional[0];
          const role = positional[1] || "reviewer";
          const task = positional.slice(2).join(" ");
          if (!workspaceId || !task) {
            throw new Error(
              "Usage: /team delegate <workspace_id> <role> <task> [--mode sequential|supervisor|single] [--roles reviewer,implementer] [--require-approval]",
            );
          }
          const delegation = await createTeamDelegation(baseUrl, token, {
            workspace_id: workspaceId,
            session_id: sessionId,
            assigned_role: role,
            task,
            priority: "normal",
            orchestration_mode: flags.mode,
            agent_roles: flags.roles,
            require_step_approval: flags.requireApproval,
          });
          setReviewTitle("Delegation queued");
          setDiffPreview(`${delegation.task_id}: ${delegation.status}`);
          pushEvent(`team: delegation ${delegation.task_id}`);
        } else if (sub === "approve") {
          const tokens = splitShellWords(subArg).map(stripQuotes);
          const taskId = tokens[0];
          const reject = tokens.includes("--reject");
          const noteIndex = tokens.indexOf("--note");
          const note = noteIndex >= 0 ? tokens.slice(noteIndex + 1).join(" ") : "";
          if (!taskId || taskId.startsWith("--")) {
            throw new Error("Usage: /team approve <task_id> [--reject] [--note text]");
          }
          const result = await approveTeamDelegationStep(baseUrl, token, taskId, {
            approved: !reject,
            note,
          });
          setReviewTitle(`Delegation ${taskId}`);
          setDiffPreview(`${result.status}: ${result.note || ""}`);
          pushEvent(`team: approve ${result.status}`);
        } else if (sub === "grants") {
          const workspaceId = subArg || null;
          if (!workspaceId) {
            throw new Error("Usage: /team grants <workspace_id>");
          }
          const result = await listWorkspaceSessionGrants(baseUrl, token, workspaceId);
          const lines = (result.grants || []).map(
            (grant) => `${grant.grant_id}: ${grant.granted_to_user_id} · ${grant.session_id} · ${grant.access_level}`,
          );
          setReviewTitle("Session grants");
          setDiffPreview(lines.length ? lines.join("\n") : "No session grants yet.");
          pushEvent(`team: ${lines.length} grant(s)`);
        } else if (sub === "grant") {
          const tokens = splitShellWords(subArg).map(stripQuotes);
          const workspaceId = tokens[0];
          const grantedTo = tokens[1];
          const accessLevel = (tokens[2] || "delegate").toLowerCase();
          if (!workspaceId || !grantedTo) {
            throw new Error("Usage: /team grant <workspace_id> <user_id> [view|delegate]");
          }
          const grant = await createWorkspaceSessionGrant(baseUrl, token, workspaceId, {
            session_id: sessionId,
            granted_to_user_id: grantedTo,
            access_level: accessLevel,
          });
          setReviewTitle("Session grant created");
          setDiffPreview(`${grant.grant_id}: ${grantedTo} · ${accessLevel}`);
          pushEvent(`team: grant ${grant.grant_id}`);
        } else if (sub === "style-guide") {
          const guideTokens = splitShellWords(subArg).map(stripQuotes);
          const guideAction = (guideTokens[0] || "").toLowerCase();
          if (guideAction === "create") {
            const workspaceId = guideTokens[1];
            const title = guideTokens[2];
            const typeIndex = guideTokens.indexOf("--type");
            const guideType = typeIndex >= 0 ? guideTokens[typeIndex + 1] || "style" : "style";
            const contentStart = typeIndex >= 0 ? typeIndex + 2 : 3;
            const content = guideTokens.slice(contentStart).join(" ");
            if (!workspaceId || !title || content.length < 8) {
              throw new Error(
                "Usage: /team style-guide create <workspace_id> <title> [--type style|conventions|architecture] <content>",
              );
            }
            const created = await createTeamStyleGuide(baseUrl, token, workspaceId, {
              title,
              guide_type: guideType,
              content,
            });
            setReviewTitle("Style guide created");
            setDiffPreview(`${created.guide_id}: ${created.title}`);
            pushEvent(`team: style guide ${created.guide_id} created`);
          } else if (guideAction === "update") {
            const workspaceId = guideTokens[1];
            const guideId = guideTokens[2];
            const titleIndex = guideTokens.indexOf("--title");
            const contentIndex = guideTokens.indexOf("--content");
            const payload = {};
            if (titleIndex >= 0) {
              payload.title = guideTokens[titleIndex + 1];
            }
            if (contentIndex >= 0) {
              payload.content = guideTokens.slice(contentIndex + 1).join(" ");
            }
            if (!workspaceId || !guideId || !Object.keys(payload).length) {
              throw new Error(
                "Usage: /team style-guide update <workspace_id> <guide_id> [--title text] [--content text]",
              );
            }
            const updated = await updateTeamStyleGuide(baseUrl, token, workspaceId, guideId, payload);
            setReviewTitle("Style guide updated");
            setDiffPreview(`${updated.guide_id}: ${updated.title}`);
            pushEvent(`team: style guide ${updated.guide_id} updated`);
          } else {
            throw new Error(
              "Usage: /team style-guide create <workspace_id> <title> [--type ...] <content> | update <workspace_id> <guide_id> [--title ...] [--content ...]",
            );
          }
        } else if (sub === "style-guides") {
          let workspaceId = subArg || null;
          if (!workspaceId) {
            const workspaces = await listTeamWorkspaces(baseUrl, token);
            workspaceId = workspaces.workspaces?.[0]?.workspace_id || null;
          }
          if (!workspaceId) {
            throw new Error("Usage: /team style-guides [workspace_id]");
          }
          const result = await listTeamStyleGuides(baseUrl, token, workspaceId);
          const lines = (result.guides || []).map(
            (guide) => `${guide.guide_id}: ${guide.title} (${guide.guide_type})`,
          );
          setReviewTitle("Style guides");
          setDiffPreview(lines.length ? lines.join("\n") : "No style guides yet.");
          pushEvent(`team: ${lines.length} style guide(s)`);
        } else if (sub === "events") {
          const lines = [];
          const iterator = streamTeamEvents(baseUrl, token);
          const timeout = Date.now() + 5000;
          for await (const event of iterator) {
            lines.push(`${event.type || "event"}: ${JSON.stringify(event).slice(0, 120)}`);
            if (lines.length >= 5 || Date.now() > timeout) {
              break;
            }
          }
          setReviewTitle("Team live events");
          setDiffPreview(lines.length ? lines.join("\n") : "No events in the last few seconds.");
          pushEvent(`team: ${lines.length} live event(s)`);
        } else if (sub === "execute") {
          if (!subArg) {
            throw new Error("Usage: /team execute <task_id>");
          }
          const result = await executeTeamDelegation(baseUrl, token, subArg.trim());
          setReviewTitle(`Delegation ${subArg}`);
          setDiffPreview(`${result.status}: ${result.note || ""}`);
          pushEvent(`team: execute ${result.status}`);
        } else if (sub === "audit") {
          const result = await listTeamAuditLog(baseUrl, token, subArg || null, 30);
          const lines = (result.events || []).map(
            (event) => `${event.event_type} ${event.resource_type}/${event.resource_id}`,
          );
          setReviewTitle("Team audit log");
          setDiffPreview(lines.length ? lines.join("\n") : "No audit events yet.");
          pushEvent(`team: audit ${lines.length} event(s)`);
        } else if (sub === "member") {
          const tokens = splitShellWords(subArg).map(stripQuotes);
          const workspaceId = tokens[0];
          const memberId = tokens[1];
          const role = tokens[2] || "member";
          if (!workspaceId || !memberId) {
            throw new Error("Usage: /team member <workspace_id> <user_id> [role]");
          }
          await addTeamWorkspaceMember(baseUrl, token, workspaceId, { user_id: memberId, role });
          setReviewTitle("Member added");
          setDiffPreview(`${memberId} added as ${role}`);
          pushEvent(`team: member ${memberId}`);
        } else if (sub === "share") {
          const share = await createSessionShare(baseUrl, token, sessionId);
          setReviewTitle("Session share");
          setDiffPreview(share.share_url || share.share_id);
          pushEvent(`team: share ${share.share_id}`);
        } else if (sub === "export") {
          const format = (subArg || "json").toLowerCase();
          const exported = await exportSession(baseUrl, token, sessionId, format);
          setReviewTitle(`Session export (${format})`);
          setDiffPreview(exported.content.slice(0, 1200));
          pushEvent(`team: export ${format}`);
        } else if (sub === "remote") {
          const remoteSub = (rest[1] || "list").toLowerCase();
          const remoteArg = rest.slice(2).join(" ").trim();
          if (remoteSub === "list") {
            const result = await listRemoteChannels(baseUrl, token);
            const lines = (result.channels || []).map(
              (channel) => `${channel.channel_id}: ${channel.label} code=${channel.pairing_code}`,
            );
            setReviewTitle("Remote channels");
            setDiffPreview(lines.length ? lines.join("\n") : "No channels yet.");
          } else if (remoteSub === "create") {
            const channel = await createRemoteChannel(baseUrl, token, { label: remoteArg || "Terminal remote" });
            setReviewTitle("Remote channel");
            setDiffPreview(`${channel.channel_id} pairing=${channel.pairing_code}`);
          } else if (remoteSub === "pair") {
            const tokens = splitShellWords(remoteArg).map(stripQuotes);
            const pairingCode = tokens[0];
            const clientId = tokens[1] || userId;
            const channel = await pairRemoteChannel(baseUrl, token, { pairing_code: pairingCode, client_id: clientId });
            setReviewTitle("Remote paired");
            setDiffPreview(`${channel.channel_id} paired with ${channel.paired_client_id}`);
          } else if (remoteSub === "push") {
            const tokens = splitShellWords(remoteArg).map(stripQuotes);
            const channelId = tokens[0];
            const eventType = tokens[1] || "terminal.command";
            const message = tokens.slice(2).join(" ") || "ping";
            await pushRemoteChannelEvent(baseUrl, token, channelId, {
              event_type: eventType,
              payload: { message },
            });
            setReviewTitle("Remote push");
            setDiffPreview(`Queued ${eventType} on ${channelId}`);
          } else {
            throw new Error("Usage: /team remote list|create [label]|pair <code> [client]|push <channel> [type] [message]");
          }
        } else {
          throw new Error(
            "Usage: /team workspaces | create <name> | kb [title] | query <text> | delegations [workspace] | delegate <ws> <role> <task> [--mode ...] [--roles ...] [--require-approval] | execute <task_id> | approve <task_id> [--reject] | style-guides [workspace] | events | audit [workspace] | member <ws> <user> [role] | share | export [json|markdown] | remote ...",
          );
        }
      } catch (teamError) {
        setError(teamError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "cowork") {
      if (!token) {
        setError(loginFirstMessage());
        return;
      }

      setBusy(true);
      setError("");
      try {
        const sessionId = await ensureSession(token);
        const sub = (rest[0] || "plans").toLowerCase();
        const subArg = rest.slice(1).join(" ").trim();

        if (sub === "plans") {
          const result = await listCoworkPlans(baseUrl, token);
          const lines = (result.plans || []).slice(0, 12).map(
            (plan) => `${plan.plan_id}: ${plan.title} (${plan.task_type}) — ${plan.status}`,
          );
          setReviewTitle("Cowork plans");
          setDiffPreview(lines.length ? lines.join("\n") : "No plans yet.");
          pushEvent(`cowork: ${lines.length} plan(s)`);
        } else if (sub === "runs") {
          const result = await listCoworkRuns(baseUrl, token);
          const lines = (result.runs || []).slice(0, 12).map(
            (run) => `${run.run_id}: ${run.status} — ${run.summary}`,
          );
          setReviewTitle("Cowork runs");
          setDiffPreview(lines.length ? lines.join("\n") : "No runs yet.");
          pushEvent(`cowork: ${lines.length} run(s)`);
        } else if (sub === "shell") {
          if (!subArg) {
            throw new Error("Usage: /cowork shell <command>");
          }
          const plan = await createCoworkPlan(baseUrl, token, {
            session_id: sessionId,
            title: "Terminal shell task",
            task_type: "shell",
            command: subArg,
          });
          const run = await runCoworkPlan(baseUrl, token, plan.plan_id, true);
          setReviewTitle(`Cowork run ${run.run_id}`);
          setDiffPreview(`${run.status}: ${run.summary}`);
          pushEvent(`cowork: shell ${run.status}`);
        } else if (sub === "extract") {
          if (!subArg) {
            throw new Error("Usage: /cowork extract <relative/path>");
          }
          const extraction = await extractCoworkData(baseUrl, token, {
            session_id: sessionId,
            source_path: subArg,
          });
          setReviewTitle(`Extraction ${extraction.extraction_id}`);
          setDiffPreview(`${extraction.method}: ${extraction.text_excerpt?.slice(0, 400) || ""}`);
          pushEvent(`cowork: extract ${extraction.extraction_id}`);
        } else if (sub === "run") {
          const tokens = splitShellWords(subArg).map(stripQuotes);
          const planId = tokens[0];
          if (!planId) {
            throw new Error("Usage: /cowork run <plan_id> [--approve]");
          }
          const approved = subArg.includes("--approve");
          const run = await runCoworkPlan(baseUrl, token, planId, approved);
          setReviewTitle(`Cowork run ${run.run_id}`);
          setDiffPreview(`${run.status}: ${run.summary}`);
          pushEvent(`cowork: run ${run.status}`);
        } else if (sub === "jobs") {
          const result = await listCoworkJobs(baseUrl, token);
          const lines = (result.jobs || []).map(
            (job) => `${job.job_id}: ${job.title} enabled=${job.enabled} trigger=${job.trigger_type}`,
          );
          setReviewTitle("Cowork jobs");
          setDiffPreview(lines.length ? lines.join("\n") : "No jobs yet.");
          pushEvent(`cowork: ${lines.length} job(s)`);
        } else if (sub === "job") {
          const tokens = splitShellWords(subArg).map(stripQuotes);
          const action = (tokens[0] || "").toLowerCase();
          if (action === "create") {
            const title = tokens[1] || "Terminal watch job";
            const job = await createCoworkJob(baseUrl, token, {
              session_id: sessionId,
              title,
              trigger_type: "interval",
              interval_seconds: 60,
              task_type: "shell",
              command: "echo cowork",
            });
            setReviewTitle("Cowork job created");
            setDiffPreview(`${job.job_id}: ${job.title}`);
          } else if (action === "toggle") {
            const jobId = tokens[1];
            const enabled = !subArg.includes("--off");
            if (!jobId) {
              throw new Error("Usage: /cowork job toggle <job_id> [--off]");
            }
            const job = await toggleCoworkJob(baseUrl, token, jobId, enabled);
            setReviewTitle("Cowork job toggled");
            setDiffPreview(`${job.job_id} enabled=${job.enabled}`);
          } else {
            throw new Error("Usage: /cowork job create [title] | job toggle <job_id> [--off]");
          }
        } else if (sub === "browser") {
          const url = subArg || "https://example.com";
          const plan = await createCoworkPlan(baseUrl, token, {
            session_id: sessionId,
            title: "Terminal browser task",
            task_type: "browser",
            url,
            browser_action: "capture_title",
          });
          const run = await runCoworkPlan(baseUrl, token, plan.plan_id, true);
          setReviewTitle(`Browser run ${run.run_id}`);
          setDiffPreview(`${run.status}: ${run.summary}`);
          pushEvent(`cowork: browser ${run.status}`);
        } else {
          throw new Error(
            "Usage: /cowork plans | runs | shell <command> | extract <path> | run <plan_id> [--approve] | jobs | job create [title] | job toggle <id> [--off] | browser [url]",
          );
        }
      } catch (coworkError) {
        setError(coworkError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (name === "approve" || name === "reject") {
      await resolveProposal(name);
      return;
    }

    if (name === "sso") {
      const action = (argument || "start").toLowerCase();
      if (action === "start" || action === "login") {
        await beginOidcLogin();
        return;
      }
      if (action === "complete") {
        await completeOidcLogin(rest.join(" ").trim());
        return;
      }
      setError("Usage: /sso | /sso complete <code>");
      return;
    }

    if (name === "login") {
      if ((argument || "").toLowerCase() === "oidc") {
        await beginOidcLogin();
        return;
      }
      if ((argument || "").toLowerCase() === "oidc-complete") {
        await completeOidcLogin(rest.join(" ").trim());
        return;
      }
      if (oidcEnabled) {
        setError("Dev login is disabled — use /sso to sign in");
        return;
      }
      await login(argument || DEFAULT_USER_ID);
      return;
    }

    if (name === "session") {
      const nextPath = argument || projectPath;
      setProjectPath(nextPath);
      if (!token) {
        if (oidcEnabled) {
          setError(loginFirstMessage());
          return;
        }
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
        setError(loginFirstMessage());
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
      const gitWriteCommand =
        ["stage", "commit", "branch", "assist-apply"].includes(subcommand) ||
        (subcommand === "worktree" && rest[1] === "create");
      if (gitWriteCommand) {
        assertWritableSession();
      }
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
        assertWritableSession();
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
      setError(loginFirstMessage());
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

      const nextRoutingSignal = routingSignalFromMessageResponse(created);
      setRoutingSignal(nextRoutingSignal);
      pushEvent(formatRoutingSignal(nextRoutingSignal));
      pushEvent(`why: ${created.routing_reason || "n/a"}`);
      pushEvent(`est. cost USD ${created.estimated_cost}`);

      let assistantText = "";
      for await (const event of streamSessionEvents(baseUrl, token, sessionId)) {
        if (event.type === "token") {
          assistantText += event.content || "";
          setStreamingAssistant(assistantText);
          continue;
        }

        pushEvent(formatEvent(event));

        if (event.type === "run_started") {
          setRoutingSignal(routingSignalFromPayload(event.payload));
          if (event.payload?.proposal_id) {
            pushEvent(`proposal:${event.payload.proposal_id}`);
            setReviewTitle(`Proposal ${event.payload.proposal_id}`);
            setCurrentProposalId(event.payload.proposal_id);
            loadProposal(event.payload.proposal_id, token).catch(() => null);
          }
        }

        if (event.type === "complete") {
          setRoutingSignal((previous) => ({
            ...(previous || {}),
            ...routingSignalFromPayload(event.payload),
          }));
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
    getOidcConfig(baseUrl)
      .then((config) => {
        const enabled = Boolean(config.enabled);
        setOidcEnabled(enabled);
        if (enabled) {
          pushEvent("OIDC enabled — use /sso to sign in");
        } else {
          pushEvent(`Type /login ${DEFAULT_USER_ID} to start`);
        }
      })
      .catch(() => setOidcEnabled(false));
  }, [baseUrl]);

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
  const reviewLines = [
    reviewTitle,
    truncate(formatRoutingSignal(routingSignal), 78),
    ...(routingSignal?.review_required ? ["Human review recommended before apply."] : []),
    ...diffLines,
  ].slice(0, MAX_DIFF_LINES + 2);
  const shellLines = shellPreview ? shellPreview.split("\n").slice(0, 4) : ["No shell output yet."];
  const paletteHint = paletteOpen ? (findPaletteAction(paletteDraft)?.label || "Type to filter actions") : `Mode: ${activeMode}`;
  const shortcutHint = getModeHint(activeMode);
  const paneLabel = activePane ? `Focus: ${activePane}` : "Focus: none";

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text color={inkTheme.primaryBright} bold>
          CodeForge Terminal
        </Text>
        <Text dimColor>
          {bootStatus} | {busy ? "Busy" : "Ready"} | {userId || "anonymous"} | {currentSession ? currentSession.session_id : "no session"} | {paneLabel} | {paletteHint}
        </Text>
      </Box>
      <Text dimColor>
        {baseUrl} | model {routingSignal?.model_used || DEFAULT_MODEL} | project {truncate(projectPath, 36)}
      </Text>
      <Text color={routingSignal?.review_required ? inkTheme.warning : inkTheme.success}>
        {truncate(formatRoutingSignal(routingSignal), 90)} | auto {autoMode ? "on" : "off"}
        {currentSession && !canWriteSession(currentSession)
          ? ` | ${truncate(viewOnlySessionMessage(currentSession), 48)}`
          : ""}
      </Text>
      <Text dimColor>{shortcutHint}</Text>
      <Newline />
      <Box>
        <Box borderStyle="single" borderColor={activePane === "files" ? paneBorderColor : inkTheme.border} flexDirection="column" width={24} paddingX={1} marginRight={1}>
          <Text bold>Files</Text>
          {treeLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Box>
        <Box borderStyle="single" borderColor={activePane === "sessions" ? paneBorderColor : inkTheme.border} flexDirection="column" width={24} paddingX={1} marginRight={1}>
          <Text bold>Sessions</Text>
          {sessionLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Box>
        <Box borderStyle="single" borderColor={activePane === "chat" ? paneBorderColor : inkTheme.border} flexDirection="column" flexGrow={1} minWidth={30} paddingX={1} marginRight={1}>
          <Text bold>Chat</Text>
          {chatLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Box>
        <Box borderStyle="single" borderColor={activePane === "review" ? paneBorderColor : inkTheme.border} flexDirection="column" width={42} paddingX={1} marginRight={1}>
          <Text bold>Diff / Review</Text>
          {reviewLines.map((line, index) => (
            <Text key={`${index}-${line}`}>{line}</Text>
          ))}
        </Box>
        <Box borderStyle="single" borderColor={activePane === "activity" ? paneBorderColor : inkTheme.border} flexDirection="column" width={34} paddingX={1}>
          <Text bold>Activity</Text>
          {shellLines.map((line, index) => (
            <Text key={`${index}-${line}`}>{line}</Text>
          ))}
          {eventLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
          {error ? <Text color={inkTheme.danger}>{error}</Text> : null}
        </Box>
      </Box>
      <Newline />
      {paletteOpen ? (
        <Box borderStyle="single" paddingX={1} marginBottom={1}>
          <Text color={inkTheme.warning}>Palette</Text>
          <Text>{`: ${paletteDraft || "type to search"}`}</Text>
          {PALETTE_CATEGORIES.map((category) => (
            <Text key={category.label} dimColor>
              {category.label}: {category.actions.map((action) => action.label).join(" · ")}
            </Text>
          ))}
        </Box>
      ) : null}
      <Box borderStyle="single" paddingX={1}>
        <Text color={inkTheme.success}>&gt; </Text>
        <Text>{draft || "Type a prompt or /help"}</Text>
      </Box>
      <Text dimColor>
        Commands: Tab pane focus | Ctrl+P palette | Ctrl+K compact | Ctrl+Shift+U ultrareview | /team workspaces | /cowork plans | /login &lt;user&gt; | /session [path] | /use &lt;n&gt; | /refresh | /clear | /quit | /mode code|chat|review | /compact | /ultrareview | /plan &lt;files...&gt; | /plan run &lt;prompt&gt; | /plan show | /rollback | /loop --verify &lt;cmd&gt; [--max n] [--prompt text] | /approve | /reject | /git status | /git diff [path] | /git log [limit] | /git resolve-guide &lt;branch&gt; | /git assist-apply &lt;branch&gt; &lt;ours|theirs&gt; [path ...] | /run &lt;command&gt;
      </Text>
    </Box>
  );
}

render(<App />);
