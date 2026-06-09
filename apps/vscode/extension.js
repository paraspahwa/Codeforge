const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vscode = require("vscode");

let panelRef = null;
let panelState = null;
let sessionStatusBarItem = null;
let proposalStatusBarItem = null;

function getExtensionConfig() {
  return vscode.workspace.getConfiguration("codeforge");
}

function initialState(context) {
  const config = getExtensionConfig();
  const workspacePath = getWorkspacePath();
  const editorContext = getEditorContext();
  return {
    baseUrl: config.get("apiBaseUrl", "http://127.0.0.1:8000"),
    userId: config.get("userId", "dev-user"),
    token: "",
    workspacePath,
    currentFile: editorContext.currentFile,
    selectionPreview: editorContext.selectionPreview,
    selectionLineCount: editorContext.selectionLineCount,
    currentSessionId: "",
    sessions: [],
    events: [],
    messages: [],
    chatMessages: [],
    loopVerify: "pytest -q",
    loopSummary: "",
    planTargets: "",
    activePlanId: "",
    workflowOutput: "",
    autoMode: false,
    proposalId: "",
    proposalStatus: "",
    proposal: null,
    diffPreview: null,
    approvalRequest: null,
    usage: null,
    busy: false,
    lastError: "",
    lastIntent: "",
    lastModel: "",
    lastRoutingReason: "",
    confidenceScore: null,
    confidenceLabel: "",
    reviewRequired: false,
    routingTier: "",
    fallbackUsed: false,
    panelTab: "chat",
    teamWorkspaces: [],
    teamDelegations: [],
    teamAuditEvents: [],
    teamOutput: "",
    teamWorkspaceName: "Core team",
    teamKnowledgeQuery: "",
    teamMemberUserId: "",
    teamDelegationTask: "Review recent changes",
    teamLiveEvents: [],
    coworkPlans: [],
    coworkRuns: [],
    coworkJobs: [],
    coworkOutput: "",
    coworkShellCommand: "dir",
    coworkExtractPath: "",
    coworkBrowserUrl: "https://example.com",
  };
}

function applyRoutingSignal(source = {}) {
  if (!panelState) {
    return;
  }
  if (source.intent) {
    panelState.lastIntent = source.intent;
  }
  if (source.model_used || source.model) {
    panelState.lastModel = source.model_used || source.model;
  }
  if (source.routing_reason) {
    panelState.lastRoutingReason = source.routing_reason;
  }
  if (source.confidence_score !== undefined && source.confidence_score !== null) {
    panelState.confidenceScore = source.confidence_score;
  }
  if (source.confidence_label) {
    panelState.confidenceLabel = source.confidence_label;
  }
  if (source.review_required !== undefined) {
    panelState.reviewRequired = Boolean(source.review_required);
  }
  if (source.routing_tier) {
    panelState.routingTier = source.routing_tier;
  }
  if (source.fallback_used !== undefined) {
    panelState.fallbackUsed = Boolean(source.fallback_used);
  }
}

function formatRoutingSignalSummary() {
  if (!panelState?.confidenceLabel && panelState?.confidenceScore == null) {
    return "";
  }
  const score = Math.round((panelState.confidenceScore || 0) * 100);
  const review = panelState.reviewRequired ? " · review required" : "";
  const tier = panelState.routingTier ? ` · ${panelState.routingTier}` : "";
  return `confidence ${panelState.confidenceLabel || "unknown"} ${score}%${review}${tier}`;
}

async function loadSharedModule(context, relativePath) {
  const filePath = path.join(context.extensionPath, "..", "..", "packages", "shared", "src", relativePath);
  return import(pathToFileURL(filePath).href);
}

function getWorkspacePath() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    return folder.uri.fsPath;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return path.dirname(editor.document.uri.fsPath);
  }

  return "";
}

function getCurrentFile() {
  return vscode.window.activeTextEditor?.document.uri.fsPath || "";
}

function clipText(value, limit = 240) {
  if (!value) {
    return "";
  }
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1)}…`;
}

function shortLabel(value, limit = 18) {
  if (!value) {
    return "";
  }
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function getSelectionText() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "";
  }
  const selection = editor.selection;
  if (selection.isEmpty) {
    return "";
  }
  return editor.document.getText(selection);
}

function getEditorContext() {
  const selectionText = getSelectionText();
  return {
    currentFile: getCurrentFile(),
    selectionPreview: clipText(selectionText, 320),
    selectionLineCount: selectionText ? selectionText.split(/\r?\n/).length : 0,
  };
}

function buildSeedPrompt(mode) {
  const currentFile = getCurrentFile();
  const selection = getSelectionText();
  const fileLabel = currentFile ? path.basename(currentFile) : "current file";

  if (mode === "explain") {
    return selection
      ? `Explain this selection from ${fileLabel}:\n\n${selection}`
      : `Explain the current file ${fileLabel}.`;
  }

  if (mode === "refactor") {
    return selection
      ? `Refactor this selection from ${fileLabel} while preserving behavior:\n\n${selection}`
      : `Refactor the current file ${fileLabel} while preserving behavior.`;
  }

  return currentFile
    ? `Review the current file ${fileLabel} and summarize the diff or changes that should be made.`
    : "Review the current file and summarize the diff or changes that should be made.";
}

function setBusy(value) {
  panelState.busy = value;
  postState();
}

function setError(message) {
  panelState.lastError = message || "";
  postState();
}

function pushEvent(line) {
  if (!line) {
    return;
  }
  panelState.events = [...panelState.events.slice(-79), line];
  postState();
}

function getProposalTargetFile() {
  return panelState?.proposal?.target_file || panelState?.diffPreview?.file || "";
}

function updateStatusBarState() {
  if (!sessionStatusBarItem || !proposalStatusBarItem) {
    return;
  }

  const sessionId = panelState?.currentSessionId || "";
  const proposalId = panelState?.proposalId || "";
  const proposalTarget = getProposalTargetFile();

  sessionStatusBarItem.text = `$(hubot) CodeForge ${sessionId ? shortLabel(sessionId, 16) : "idle"}`;
  sessionStatusBarItem.tooltip = sessionId
    ? `Current session: ${sessionId}\nWorkspace: ${panelState?.workspacePath || getWorkspacePath()}`
    : "Open the CodeForge panel and create or select a session.";
  sessionStatusBarItem.command = "codeforge.openPanel";
  sessionStatusBarItem.show();

  if (proposalId) {
    const confidenceSuffix = panelState?.reviewRequired ? " · review" : "";
    proposalStatusBarItem.text = `$(git-pull-request) ${panelState?.proposalStatus || "pending"} ${shortLabel(proposalId, 14)}${confidenceSuffix}`;
    proposalStatusBarItem.tooltip = proposalTarget
      ? `Current proposal: ${proposalId}\nTarget: ${proposalTarget}`
      : `Current proposal: ${proposalId}`;
    proposalStatusBarItem.command = proposalTarget ? "codeforge.openProposalTarget" : "codeforge.openPanel";
  } else {
    proposalStatusBarItem.text = "$(eye) CodeForge review";
    proposalStatusBarItem.tooltip = "Open CodeForge review actions for the current file.";
    proposalStatusBarItem.command = "codeforge.reviewDiff";
  }
  proposalStatusBarItem.show();
}

function postState(extra = {}) {
  updateStatusBarState();
  if (!panelRef) {
    return;
  }
  const editorContext = getEditorContext();
  panelRef.webview.postMessage({
    type: "state",
    payload: {
      ...panelState,
      workspacePath: getWorkspacePath(),
      currentFile: editorContext.currentFile,
      selectionPreview: editorContext.selectionPreview,
      selectionLineCount: editorContext.selectionLineCount,
      ...extra,
    },
  });
}

async function refreshSessions(context) {
  const api = await loadSharedModule(context, "api.js");
  panelState.sessions = await api.listSessions(panelState.baseUrl, panelState.token);
  if (!panelState.currentSessionId && panelState.sessions.length > 0) {
    panelState.currentSessionId = panelState.sessions[0].session_id;
  }
}

async function refreshUsage(context) {
  const api = await loadSharedModule(context, "api.js");
  panelState.usage = await api.getUsageSummary(panelState.baseUrl, panelState.token);
}

async function refreshProposal(context, proposalId = panelState.proposalId) {
  if (!proposalId || !panelState.currentSessionId) {
    panelState.proposal = null;
    return;
  }

  const api = await loadSharedModule(context, "api.js");
  const proposal = await api.getProposal(
    panelState.baseUrl,
    panelState.token,
    panelState.currentSessionId,
    proposalId,
  );
  panelState.proposal = proposal;
  panelState.proposalStatus = proposal.status;

  if (!panelState.diffPreview?.patch && proposal.patch_preview) {
    panelState.diffPreview = {
      file: proposal.target_file,
      patch: proposal.patch_preview,
      kind: "proposed",
      reason: "",
    };
  }
}

async function openProposalTargetFile() {
  const targetFile = getProposalTargetFile();
  if (!targetFile) {
    vscode.window.showInformationMessage("No proposal target is available yet.");
    return;
  }

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFile));
  await vscode.window.showTextDocument(document, { preview: false });
}

async function refreshProposalGitDiff(context) {
  const targetFile = getProposalTargetFile();
  if (!panelState?.token || !panelState?.currentSessionId || !targetFile) {
    vscode.window.showInformationMessage("Create a session and load a proposal before refreshing git diff.");
    return;
  }

  const api = await loadSharedModule(context, "api.js");
  const diff = await api.getGitDiff(panelState.baseUrl, panelState.token, panelState.currentSessionId, targetFile);
  panelState.diffPreview = {
    file: diff.path || targetFile,
    patch: diff.diff || diff.stat || "git diff empty",
    kind: "git",
    reason: "Current repository diff for proposal target",
  };
  pushEvent(`gitdiff:${shortLabel(diff.path || targetFile, 32)}`);
}

async function ensureSession(context) {
  if (panelState.currentSessionId) {
    return panelState.currentSessionId;
  }

  const api = await loadSharedModule(context, "api.js");
  const created = await api.createSession(panelState.baseUrl, panelState.token, {
    project_path: panelState.workspacePath || getWorkspacePath(),
    model_preference: "auto",
  });
  panelState.currentSessionId = created.session_id;
  await refreshSessions(context);
  pushEvent(`session:${created.session_id}`);
  return created.session_id;
}

async function login(context, baseUrl, userId) {
  const api = await loadSharedModule(context, "api.js");
  panelState.baseUrl = baseUrl || panelState.baseUrl;
  panelState.userId = userId || panelState.userId;
  panelState.token = (await api.devLogin(panelState.baseUrl, panelState.userId)).access_token;
  await refreshSessions(context);
  await refreshUsage(context);
  pushEvent(`auth:${panelState.userId}`);
}

async function streamPrompt(context, prompt, currentFile) {
  const agent = await loadSharedModule(context, "agentClient.js");
  const sse = await loadSharedModule(context, "sse.js");
  const sessionId = await ensureSession(context);
  panelState.events = [];
  panelState.messages = [];
  panelState.proposalId = "";
  panelState.proposalStatus = "pending";
  panelState.proposal = null;
  panelState.diffPreview = null;
  panelState.approvalRequest = null;
  panelState.loopSummary = "";
  postState();

  const routeContext = agent.buildMessageContext({
    workspacePath: panelState.workspacePath || getWorkspacePath(),
    activeFile: currentFile || getCurrentFile(),
    selection: getSelectionText() || null,
  });

  for await (const event of agent.runChatTurn(panelState.baseUrl, panelState.token, sessionId, {
    content: prompt,
    context: routeContext,
  })) {
    if (event.type === "route") {
      const response = event.payload || {};
      applyRoutingSignal(response);
      pushEvent(`route:${response.intent}:${response.model_used}`);
      const confidenceSummary = formatRoutingSignalSummary();
      if (confidenceSummary) {
        pushEvent(confidenceSummary);
      }
      continue;
    }

    if (event.type === "run_started" || event.type === "complete") {
      applyRoutingSignal(event.payload || {});
    }
    const summary = sse.formatEvent(event);
    const payload = event?.payload || {};
    panelState.messages = [...panelState.messages, event].slice(-120);
    if (event?.type === "diff") {
      panelState.diffPreview = {
        file: payload.file || "",
        patch: payload.patch || "",
        kind: payload.kind || "",
        reason: payload.reason || "",
      };
    }
    if (event?.type === "approval_request") {
      panelState.approvalRequest = {
        scope: payload.scope || "",
        message: payload.message || "",
        reason: payload.reason || "",
      };
    }
    if (payload.proposal_id) {
      panelState.proposalId = payload.proposal_id;
      if (panelState.proposal?.proposal_id !== payload.proposal_id) {
        await refreshProposal(context, payload.proposal_id);
      }
    }
    pushEvent(summary);
  }

  if (panelState.proposalId) {
    await refreshProposal(context, panelState.proposalId);
  }

  const api = await loadSharedModule(context, "api.js");
  panelState.chatMessages = await api.listMessages(panelState.baseUrl, panelState.token, sessionId);
  await refreshUsage(context);
}

async function refreshTeamData(context) {
  const api = await loadSharedModule(context, "api.js");
  const workspaceId = panelState.teamWorkspaces[0]?.workspace_id || null;
  const [workspaces, delegations, audit] = await Promise.all([
    api.listTeamWorkspaces(panelState.baseUrl, panelState.token),
    api.listTeamDelegations(panelState.baseUrl, panelState.token, workspaceId),
    api.listTeamAuditLog(panelState.baseUrl, panelState.token, workspaceId, 20),
  ]);
  panelState.teamWorkspaces = workspaces.workspaces || [];
  panelState.teamDelegations = delegations.delegations || [];
  panelState.teamAuditEvents = audit.events || [];
}

async function refreshCoworkData(context) {
  const api = await loadSharedModule(context, "api.js");
  const [plans, runs, jobs] = await Promise.all([
    api.listCoworkPlans(panelState.baseUrl, panelState.token),
    api.listCoworkRuns(panelState.baseUrl, panelState.token),
    api.listCoworkJobs(panelState.baseUrl, panelState.token),
  ]);
  panelState.coworkPlans = plans.plans || [];
  panelState.coworkRuns = runs.runs || [];
  panelState.coworkJobs = jobs.jobs || [];
}

let teamEventPump = null;

function startTeamEventPump(context) {
  if (teamEventPump || !panelState?.token) {
    return;
  }
  teamEventPump = true;
  (async () => {
    const api = await loadSharedModule(context, "api.js");
    try {
      for await (const event of api.streamTeamEvents(panelState.baseUrl, panelState.token)) {
        if (!panelState) {
          break;
        }
        if (event.type === "heartbeat" || event.type === "connected") {
          continue;
        }
        panelState.teamLiveEvents = [JSON.stringify(event), ...(panelState.teamLiveEvents || [])].slice(0, 8);
        if (event.type === "team.audit") {
          await refreshTeamData(context);
        }
        postState();
      }
    } catch {
      // Ignore stream disconnects; user can refresh/login again.
    } finally {
      teamEventPump = null;
    }
  })();
}

async function runAgentLoop(context, verifyCommand) {
  const api = await loadSharedModule(context, "api.js");
  const sessionId = await ensureSession(context);
  const result = await api.runAgentLoop(panelState.baseUrl, panelState.token, sessionId, {
    verify_command: verifyCommand,
    prompt: "Fix verification failures with minimal safe edits.",
    max_attempts: 3,
    auto_apply: true,
    current_file: getCurrentFile() || null,
  });

  panelState.loopSummary = result.message;
  pushEvent(result.passed ? `loop:passed:${result.message}` : `loop:failed:${result.message}`);
  for (const attempt of result.attempts || []) {
    pushEvent(`loop:attempt:${attempt.attempt}:exit:${attempt.verify_exit_code}`);
    if (attempt.proposal_id) {
      panelState.proposalId = attempt.proposal_id;
      await refreshProposal(context, attempt.proposal_id);
    }
  }

  panelState.chatMessages = await api.listMessages(panelState.baseUrl, panelState.token, sessionId);
  await refreshUsage(context);
}

async function decideProposal(context, action) {
  if (!panelState.proposalId || !panelState.currentSessionId) {
    return;
  }
  const api = await loadSharedModule(context, "api.js");
  const decision = await api.decideProposal(
    panelState.baseUrl,
    panelState.token,
    panelState.currentSessionId,
    panelState.proposalId,
    action,
  );
  panelState.proposalStatus = decision.status;
  if (panelState.proposal) {
    panelState.proposal = {
      ...panelState.proposal,
      status: decision.status,
      resolved_at: decision.resolved_at,
    };
  }
  pushEvent(`proposal:${decision.status}`);
}

function getHtml(webview, extensionUri) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "panel.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "panel.css"));
  const nonce = String(Date.now());

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>CodeForge</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function ensurePanel(context) {
  if (panelRef) {
    panelRef.reveal(vscode.ViewColumn.Beside);
    return panelRef;
  }

  panelState = initialState(context);
  panelRef = vscode.window.createWebviewPanel(
    "codeforge.panel",
    "CodeForge",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    },
  );

  panelRef.webview.html = getHtml(panelRef.webview, context.extensionUri);

  panelRef.webview.onDidReceiveMessage(async (message) => {
    try {
      if (message.type === "ready") {
        postState();
        return;
      }

      if (message.type === "login") {
        setBusy(true);
        setError("");
        await login(context, message.baseUrl, message.userId);
        setBusy(false);
        return;
      }

      if (message.type === "createSession") {
        setBusy(true);
        setError("");
        panelState.workspacePath = message.projectPath || getWorkspacePath();
        panelState.currentSessionId = "";
        await ensureSession(context);
        setBusy(false);
        return;
      }

      if (message.type === "selectSession") {
        setBusy(true);
        setError("");
        panelState.currentSessionId = message.sessionId || "";
        panelState.proposalId = "";
        panelState.proposalStatus = "";
        panelState.proposal = null;
        panelState.diffPreview = null;
        panelState.approvalRequest = null;
        panelState.loopSummary = "";
        if (panelState.token && panelState.currentSessionId) {
          const api = await loadSharedModule(context, "api.js");
          panelState.chatMessages = await api.listMessages(
            panelState.baseUrl,
            panelState.token,
            panelState.currentSessionId,
          );
        } else {
          panelState.chatMessages = [];
        }
        setBusy(false);
        postState();
        return;
      }

      if (message.type === "refresh") {
        setBusy(true);
        setError("");
        await refreshSessions(context);
        await refreshUsage(context);
        setBusy(false);
        return;
      }

      if (message.type === "sendPrompt") {
        setBusy(true);
        setError("");
        await streamPrompt(context, message.prompt, getCurrentFile());
        setBusy(false);
        return;
      }

      if (message.type === "proposalDecision") {
        setBusy(true);
        setError("");
        await decideProposal(context, message.action);
        setBusy(false);
        return;
      }

      if (message.type === "openProposalTarget") {
        await openProposalTargetFile();
        return;
      }

      if (message.type === "refreshProposalDiff") {
        setBusy(true);
        setError("");
        await refreshProposalGitDiff(context);
        setBusy(false);
        return;
      }

      if (message.type === "runAgentLoop") {
        setBusy(true);
        setError("");
        panelState.loopVerify = message.verifyCommand || panelState.loopVerify || "pytest -q";
        await runAgentLoop(context, panelState.loopVerify);
        setBusy(false);
        return;
      }

      if (message.type === "compactWorkflow") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const result = await api.compactWorkflow(panelState.baseUrl, panelState.token, sessionId);
        panelState.workflowOutput = result.summary;
        panelState.prompt = result.summary;
        pushEvent("workflow:compact");
        setBusy(false);
        return;
      }

      if (message.type === "ultrareviewWorkflow") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const result = await api.ultrareviewWorkflow(panelState.baseUrl, panelState.token, sessionId, {});
        panelState.workflowOutput = result.report;
        pushEvent(`workflow:ultrareview:${result.risk_level}`);
        setBusy(false);
        return;
      }

      if (message.type === "createWorkflowPlan") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const targets = String(message.targets || "")
          .split(/[\s,]+/)
          .map((item) => item.trim())
          .filter(Boolean);
        const plan = await api.createWorkflowPlan(panelState.baseUrl, panelState.token, sessionId, targets);
        panelState.activePlanId = plan.plan_id;
        panelState.workflowOutput = `Plan ${plan.plan_id}: ${plan.targets.join(", ")}`;
        pushEvent(`workflow:plan:${plan.plan_id}`);
        setBusy(false);
        return;
      }

      if (message.type === "executeWorkflowPlan") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const result = await api.executeWorkflowPlan(
          panelState.baseUrl,
          panelState.token,
          sessionId,
          panelState.activePlanId,
          {
            prompt: message.prompt || panelState.prompt,
            auto_mode: Boolean(message.autoMode ?? panelState.autoMode),
          },
        );
        panelState.workflowOutput = result.message;
        pushEvent(`workflow:plan:${result.status}`);
        setBusy(false);
        return;
      }

      if (message.type === "rollbackWorkflowPlan") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const result = await api.rollbackWorkflowPlan(
          panelState.baseUrl,
          panelState.token,
          sessionId,
          panelState.activePlanId,
        );
        panelState.workflowOutput = result.message;
        pushEvent(`workflow:rollback:${result.restored_paths.length}`);
        setBusy(false);
        return;
      }

      if (message.type === "forkSession") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const forked = await api.forkSession(panelState.baseUrl, panelState.token, sessionId);
        panelState.currentSessionId = forked.session_id;
        await refreshSessions(context);
        pushEvent(`workflow:fork:${forked.session_id}`);
        setBusy(false);
        return;
      }

      if (message.type === "setPanelTab") {
        panelState.panelTab = message.tab || "chat";
        postState();
        return;
      }

      if (message.type === "teamRefresh") {
        setBusy(true);
        setError("");
        await refreshTeamData(context);
        startTeamEventPump(context);
        panelState.teamOutput = `${panelState.teamWorkspaces.length} workspace(s) loaded`;
        pushEvent(`team:${panelState.teamWorkspaces.length} workspace(s)`);
        setBusy(false);
        return;
      }

      if (message.type === "teamCreateWorkspace") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const workspace = await api.createTeamWorkspace(panelState.baseUrl, panelState.token, {
          name: message.name || panelState.teamWorkspaceName,
          description: "Created from VS Code",
        });
        await refreshTeamData(context);
        panelState.teamOutput = `Created ${workspace.workspace_id}: ${workspace.name}`;
        pushEvent(`team:created:${workspace.workspace_id}`);
        setBusy(false);
        return;
      }

      if (message.type === "teamRebuildKb") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const kb = await api.rebuildProjectKnowledge(panelState.baseUrl, panelState.token, {
          session_id: sessionId,
          title: message.title || "VS Code knowledge index",
        });
        panelState.teamOutput = kb.summary || `Knowledge rebuilt (${kb.knowledge_id})`;
        pushEvent(`team:kb:${kb.knowledge_id}`);
        setBusy(false);
        return;
      }

      if (message.type === "teamQueryKnowledge") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const result = await api.queryProjectKnowledge(panelState.baseUrl, panelState.token, {
          session_id: sessionId,
          query: message.query || panelState.teamKnowledgeQuery,
          limit: 6,
        });
        const lines = (result.results || []).map((item) => `${item.path}: ${item.excerpt}`);
        panelState.teamOutput = lines.length ? lines.join("\n\n") : "No matches.";
        pushEvent(`team:query:${lines.length} hit(s)`);
        setBusy(false);
        return;
      }

      if (message.type === "teamShareSession") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const share = await api.createSessionShare(panelState.baseUrl, panelState.token, sessionId);
        panelState.teamOutput = share.share_url || share.share_id;
        pushEvent(`team:share:${share.share_id}`);
        setBusy(false);
        return;
      }

      if (message.type === "teamExportSession") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const exported = await api.exportSession(panelState.baseUrl, panelState.token, sessionId, "json");
        panelState.teamOutput = `json export (${exported.content.length} chars)`;
        pushEvent("team:export:json");
        setBusy(false);
        return;
      }

      if (message.type === "teamAddMember") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const workspaceId = panelState.teamWorkspaces[0]?.workspace_id;
        if (!workspaceId || !message.memberUserId) {
          setError("Create/refresh a workspace and enter a member user ID");
          setBusy(false);
          return;
        }
        await api.addTeamWorkspaceMember(panelState.baseUrl, panelState.token, workspaceId, {
          user_id: message.memberUserId,
          role: "member",
        });
        await refreshTeamData(context);
        panelState.teamOutput = `Added ${message.memberUserId}`;
        pushEvent(`team:member:${message.memberUserId}`);
        setBusy(false);
        return;
      }

      if (message.type === "teamCreateDelegation") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const workspaceId = panelState.teamWorkspaces[0]?.workspace_id;
        if (!workspaceId) {
          setError("Create/refresh a workspace first");
          setBusy(false);
          return;
        }
        const delegation = await api.createTeamDelegation(panelState.baseUrl, panelState.token, {
          workspace_id: workspaceId,
          session_id: sessionId,
          assigned_role: "reviewer",
          task: message.task || panelState.teamDelegationTask,
          priority: "normal",
        });
        await refreshTeamData(context);
        panelState.teamOutput = `Delegation ${delegation.task_id} queued`;
        pushEvent(`team:delegation:${delegation.task_id}`);
        setBusy(false);
        return;
      }

      if (message.type === "teamExecuteDelegation") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const result = await api.executeTeamDelegation(panelState.baseUrl, panelState.token, message.taskId);
        await refreshTeamData(context);
        panelState.teamOutput = `${message.taskId}: ${result.status}`;
        pushEvent(`team:execute:${result.status}`);
        setBusy(false);
        return;
      }

      if (message.type === "coworkRefresh") {
        setBusy(true);
        setError("");
        await refreshCoworkData(context);
        panelState.coworkOutput = `${panelState.coworkPlans.length} plan(s), ${panelState.coworkRuns.length} run(s)`;
        pushEvent(`cowork:${panelState.coworkPlans.length} plan(s)`);
        setBusy(false);
        return;
      }

      if (message.type === "coworkShell") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const command = message.command || panelState.coworkShellCommand;
        const plan = await api.createCoworkPlan(panelState.baseUrl, panelState.token, {
          session_id: sessionId,
          title: "VS Code shell task",
          task_type: "shell",
          command,
        });
        const run = await api.runCoworkPlan(panelState.baseUrl, panelState.token, plan.plan_id, true);
        await refreshCoworkData(context);
        panelState.coworkOutput = `${run.status}: ${run.summary}`;
        pushEvent(`cowork:shell:${run.status}`);
        setBusy(false);
        return;
      }

      if (message.type === "coworkExtract") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const extraction = await api.extractCoworkData(panelState.baseUrl, panelState.token, {
          session_id: sessionId,
          source_path: message.sourcePath || panelState.coworkExtractPath,
        });
        panelState.coworkOutput = `${extraction.method}: ${(extraction.text_excerpt || "").slice(0, 500)}`;
        pushEvent(`cowork:extract:${extraction.extraction_id}`);
        setBusy(false);
        return;
      }

      if (message.type === "coworkRunPlan") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const run = await api.runCoworkPlan(
          panelState.baseUrl,
          panelState.token,
          message.planId,
          Boolean(message.approved),
        );
        await refreshCoworkData(context);
        panelState.coworkOutput = `${run.status}: ${run.summary}`;
        pushEvent(`cowork:run:${run.status}`);
        setBusy(false);
        return;
      }

      if (message.type === "coworkBrowser") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const sessionId = await ensureSession(context);
        const plan = await api.createCoworkPlan(panelState.baseUrl, panelState.token, {
          session_id: sessionId,
          title: "VS Code browser task",
          task_type: "browser",
          url: message.url || panelState.coworkBrowserUrl,
          browser_action: "capture_title",
        });
        const run = await api.runCoworkPlan(panelState.baseUrl, panelState.token, plan.plan_id, true);
        await refreshCoworkData(context);
        panelState.coworkOutput = `${run.status}: ${run.summary}`;
        pushEvent(`cowork:browser:${run.status}`);
        setBusy(false);
        return;
      }

      if (message.type === "coworkRefreshJobs") {
        setBusy(true);
        setError("");
        await refreshCoworkData(context);
        panelState.coworkOutput = `${panelState.coworkJobs.length} job(s)`;
        pushEvent(`cowork:jobs:${panelState.coworkJobs.length}`);
        setBusy(false);
        return;
      }

      if (message.type === "coworkToggleJob") {
        setBusy(true);
        setError("");
        const api = await loadSharedModule(context, "api.js");
        const job = await api.toggleCoworkJob(
          panelState.baseUrl,
          panelState.token,
          message.jobId,
          Boolean(message.enabled),
        );
        await refreshCoworkData(context);
        panelState.coworkOutput = `${job.job_id} enabled=${job.enabled}`;
        pushEvent(`cowork:job:${job.enabled ? "on" : "off"}`);
        setBusy(false);
        return;
      }
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error ? error.message : String(error));
    }
  });

  panelRef.onDidDispose(() => {
    panelRef = null;
    panelState = null;
  });

  return panelRef;
}

function seedPrompt(context, mode) {
  const panel = ensurePanel(context);
  const prompt = buildSeedPrompt(mode);
  panel.webview.postMessage({
    type: "seedPrompt",
    payload: {
      prompt,
      currentFile: getCurrentFile(),
    },
  });
}

function openPanelTab(context, tab) {
  ensurePanel(context);
  panelState.panelTab = tab;
  postState();
}

function activate(context) {
  sessionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  proposalStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  updateStatusBarState();

  context.subscriptions.push(
    sessionStatusBarItem,
    proposalStatusBarItem,
    vscode.commands.registerCommand("codeforge.openPanel", () => {
      ensurePanel(context);
    }),
    vscode.commands.registerCommand("codeforge.explainSelection", () => {
      seedPrompt(context, "explain");
    }),
    vscode.commands.registerCommand("codeforge.refactorSelection", () => {
      seedPrompt(context, "refactor");
    }),
    vscode.commands.registerCommand("codeforge.reviewDiff", () => {
      seedPrompt(context, "diff");
    }),
    vscode.commands.registerCommand("codeforge.openProposalTarget", async () => {
      await openProposalTargetFile();
    }),
    vscode.commands.registerCommand("codeforge.refreshProposalDiff", async () => {
      await refreshProposalGitDiff(context);
    }),
    vscode.commands.registerCommand("codeforge.openTeam", () => {
      openPanelTab(context, "team");
    }),
    vscode.commands.registerCommand("codeforge.openCowork", () => {
      openPanelTab(context, "cowork");
    }),
    vscode.commands.registerCommand("codeforge.runAgentLoop", async () => {
      const panel = ensurePanel(context);
      const verifyCommand = await vscode.window.showInputBox({
        prompt: "Verification command for the agent loop",
        value: panelState?.loopVerify || "pytest -q",
      });
      if (!verifyCommand) {
        return;
      }
      setBusy(true);
      setError("");
      try {
        await runAgentLoop(context, verifyCommand);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
      panel.reveal(vscode.ViewColumn.Beside);
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (panelRef && panelState) {
        postState();
        return;
      }
      updateStatusBarState();
    }),
    vscode.window.onDidChangeTextEditorSelection(() => {
      if (panelRef && panelState) {
        postState();
        return;
      }
      updateStatusBarState();
    }),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};