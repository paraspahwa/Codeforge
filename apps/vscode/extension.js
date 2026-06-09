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
  };
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
    proposalStatusBarItem.text = `$(git-pull-request) ${panelState?.proposalStatus || "pending"} ${shortLabel(proposalId, 14)}`;
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
      panelState.lastIntent = response.intent || "";
      panelState.lastModel = response.model_used || "";
      panelState.lastRoutingReason = response.routing_reason || "";
      pushEvent(`route:${response.intent}:${response.model_used}`);
      continue;
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