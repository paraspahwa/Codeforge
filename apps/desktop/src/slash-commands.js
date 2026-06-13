import {
  commitGitChanges,
  compactWorkflow,
  createPullRequest,
  exportMemory,
  exportTaste,
  getAgentPreferences,
  getContextStack,
  getGitDiff,
  getGitStatus,
  getRtkStatus,
  getSupermemoryStatus,
  getTasteRules,
  getTasteStats,
  gitPush,
  listCheckpoints,
  listMemories,
  listSkills,
  listWorkspaceFiles,
  rewindCheckpoint,
  saveMemory,
  searchMemory,
  searchSupermemory,
  searchSymbols,
  searchWeb,
  saveSupermemory,
  stageGitFiles,
  streamShellCommand,
  updateAgentPreferences,
} from "./api";

const HELP_TEXT = `Desktop slash commands:

/code & navigation
/files list — list workspace files
/symbol <name> — find symbols
/file <path> — set active file
/git status|diff|stage|commit|push — git operations
/run <command> — sandboxed shell
/plan <files…> — multi-file plan (session required)

/mode plan|execute|off — plan mode
/context — show context stack
/compact — compact conversation
/pr create <title> — create pull request
/rewind [checkpoint_id] — list or restore checkpoints
/search <query> — web search

/memory, /taste, /caveman, /rtk, /supermemory — preferences
/help — this message`;

function parseCommand(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return null;
  }
  return { name: parts[0].toLowerCase(), rest: parts.slice(1) };
}

export async function runSlashCommand({ text, token, projectPath, sessionId, planMode = false }) {
  const parsed = parseCommand(text);
  if (!parsed) {
    return { handled: false };
  }

  const { name, rest } = parsed;
  const sub = (rest[0] || "").toLowerCase();
  const subArg = rest.slice(1).join(" ").trim();
  const argLine = rest.join(" ").trim();

  if (name === "help") {
    return { handled: true, reply: HELP_TEXT };
  }

  if (!token) {
    return { handled: true, reply: "Sign in required for slash commands." };
  }

  try {
    if (name === "file") {
      const path = argLine.trim();
      if (!path) {
        return { handled: true, reply: "Usage: /file <path>" };
      }
      return { handled: true, reply: `Active file set to ${path}`, activeFile: path };
    }

    if (name === "files" && sessionId) {
      const result = await listWorkspaceFiles(token, sessionId);
      const lines = (result.files || []).slice(0, 40);
      return { handled: true, reply: lines.length ? lines.join("\n") : "No files found." };
    }

    if (name === "symbol" && sessionId) {
      const query = argLine.trim();
      if (!query) {
        return { handled: true, reply: "Usage: /symbol <name>" };
      }
      const result = await searchSymbols(token, sessionId, query);
      const lines = (result.matches || []).slice(0, 12).map(
        (item) => `${item.kind} ${item.symbol} — ${item.file}:${item.line}`,
      );
      return { handled: true, reply: lines.length ? lines.join("\n") : "No symbols matched." };
    }

    if (name === "search" && sessionId) {
      const query = argLine.trim();
      if (!query) {
        return { handled: true, reply: "Usage: /search <query>" };
      }
      const result = await searchWeb(token, sessionId, query);
      const lines = (result.results || []).map((item) => `${item.title} — ${item.url}`);
      return { handled: true, reply: lines.length ? lines.join("\n") : "No web results." };
    }

    if (name === "run" && sessionId) {
      const command = argLine.trim();
      if (!command) {
        return { handled: true, reply: "Usage: /run <command>" };
      }
      const chunks = [];
      for await (const evt of streamShellCommand(token, sessionId, { command })) {
        if (evt.type === "shell_output") {
          chunks.push(evt.payload?.chunk || evt.payload?.output || "");
        }
      }
      return { handled: true, reply: chunks.join("") || "Command finished." };
    }

    if (name === "mode") {
      if (sub === "plan") {
        return { handled: true, reply: "Plan mode enabled.", planMode: true };
      }
      if (sub === "execute" || sub === "off") {
        return { handled: true, reply: "Plan mode disabled.", planMode: false };
      }
      return { handled: true, reply: `Plan mode is ${planMode ? "on" : "off"}.` };
    }

    if (name === "context" && sessionId) {
      const stack = await getContextStack(token, sessionId);
      return {
        handled: true,
        reply: [
          `Skills: ${(stack.skills || []).join(", ") || "none"}`,
          `Packs: ${(stack.packs || []).join(", ") || "none"}`,
        ].join("\n"),
      };
    }

    if (name === "compact" && sessionId) {
      const result = await compactWorkflow(token, sessionId);
      return { handled: true, reply: result.summary || "Context compacted." };
    }

    if (name === "pr" && sessionId && sub === "create") {
      const result = await createPullRequest(token, sessionId, {
        title: subArg || "CodeForge changes",
        body: "Automated PR from CodeForge.",
        provider: "github",
      });
      return { handled: true, reply: result.url || result.message || "PR created." };
    }

    if (name === "rewind" && sessionId) {
      const checkpointId = argLine.trim();
      if (!checkpointId) {
        const rows = await listCheckpoints(token, sessionId);
        const lines = (rows.checkpoints || []).map((item) => `${item.checkpoint_id} — ${item.label}`);
        return { handled: true, reply: lines.length ? lines.join("\n") : "No checkpoints." };
      }
      const result = await rewindCheckpoint(token, sessionId, checkpointId);
      return { handled: true, reply: `Rewound: ${(result.restored_paths || []).join(", ")}` };
    }

    if (name === "git" && sessionId) {
      if (sub === "status") {
        const status = await getGitStatus(token, sessionId);
        return { handled: true, reply: `${status.branch} | ${status.summary}` };
      }
      if (sub === "diff") {
        const diff = await getGitDiff(token, sessionId, subArg || null);
        return { handled: true, reply: diff.diff || diff.stat || "No diff." };
      }
      if (sub === "stage") {
        const paths = subArg ? subArg.split(/\s+/) : [];
        await stageGitFiles(token, sessionId, { paths, all_files: !paths.length });
        return { handled: true, reply: "Files staged." };
      }
      if (sub === "commit") {
        if (!subArg) {
          return { handled: true, reply: "Usage: /git commit <message>" };
        }
        const result = await commitGitChanges(token, sessionId, subArg);
        return { handled: true, reply: result.message || "Committed." };
      }
      if (sub === "push") {
        const result = await gitPush(token, sessionId, { remote: "origin", branch: rest[1] || "" });
        return { handled: true, reply: result.output || "Push completed." };
      }
      return { handled: true, reply: "Usage: /git status|diff|stage|commit|push" };
    }

    if (name === "memory") {
      const action = sub || "list";
      if (action === "list") {
        const result = await listMemories(token, projectPath || null);
        const lines = (result.memories || []).map(
          (item) => `[${item.kind}/${item.scope}] ${item.content.slice(0, 120)}`,
        );
        return { handled: true, reply: lines.length ? lines.join("\n") : "No memories saved yet." };
      }
      if (action === "search") {
        const query = subArg || argLine.replace(/^search\s*/i, "").trim();
        if (!query) {
          return { handled: true, reply: "Usage: /memory search <query>" };
        }
        const result = await searchMemory(token, query, projectPath || null);
        const lines = [
          ...(result.native || []).map((item) => `[native/${item.kind}] ${item.content}`),
          ...(result.supermemory || []).map((item) => `[supermemory] ${item.memory}`),
        ];
        return { handled: true, reply: lines.length ? lines.join("\n") : "No matches." };
      }
      if (action === "save") {
        const content = subArg;
        if (!content) {
          return { handled: true, reply: "Usage: /memory save <text>" };
        }
        await saveMemory(token, { content, project_path: projectPath || null, kind: "note", scope: "project" });
        return { handled: true, reply: "Memory saved." };
      }
      if (action === "export") {
        const pack = await exportMemory(token);
        return { handled: true, reply: `Exported ${pack.memories?.length || 0} memories.` };
      }
      return { handled: true, reply: "Usage: /memory list|search|save|export" };
    }

    if (name === "taste") {
      const action = sub || "stats";
      if (action === "stats") {
        const stats = await getTasteStats(token);
        return {
          handled: true,
          reply: `rules=${stats.rule_count} applied=${stats.applied_count} blocked=${stats.blocked_count}`,
        };
      }
      if (action === "rules") {
        const result = await getTasteRules(token);
        const lines = (result.rules || []).map((rule) => `${rule.id}: ${rule.description}`);
        return {
          handled: true,
          reply: lines.length ? lines.join("\n") : result.taste_md || "No taste rules yet.",
        };
      }
      if (action === "export") {
        const pack = await exportTaste(token);
        return { handled: true, reply: `Taste pack has ${pack.rules?.length || 0} rules.` };
      }
      return { handled: true, reply: "Usage: /taste stats|rules|export" };
    }

    if (name === "caveman") {
      const modeArg = sub || "status";
      if (modeArg === "status") {
        const prefs = await getAgentPreferences(token);
        return {
          handled: true,
          reply: [
            `caveman_mode: ${prefs.caveman_mode}`,
            `permission_mode: ${prefs.permission_mode || "auto_safe"}`,
            `plan_mode_default: ${prefs.plan_mode_default ? "on" : "off"}`,
          ].join("\n"),
        };
      }
      if (modeArg === "skills") {
        const result = await listSkills(token, projectPath || null);
        const lines = (result.skills || []).map((skill) => `${skill.name} [${skill.origin}]`);
        return { handled: true, reply: lines.length ? lines.join("\n") : "No skills found." };
      }
      if (["off", "lite", "full", "ultra"].includes(modeArg)) {
        const prefs = await updateAgentPreferences(token, { caveman_mode: modeArg });
        return { handled: true, reply: `caveman_mode set to ${prefs.caveman_mode}` };
      }
      return { handled: true, reply: "Usage: /caveman off|lite|full|ultra|status|skills" };
    }

    if (name === "rtk") {
      const rtkSub = sub || "status";
      if (rtkSub === "status") {
        const status = await getRtkStatus(token);
        return { handled: true, reply: `rtk_enabled: ${status.effective_enabled}` };
      }
      if (rtkSub === "on" || rtkSub === "off") {
        const prefs = await updateAgentPreferences(token, { rtk_enabled: rtkSub === "on" });
        return { handled: true, reply: `rtk_enabled set to ${prefs.rtk_enabled}` };
      }
      return { handled: true, reply: "Usage: /rtk on|off|status" };
    }

    if (name === "supermemory") {
      const smSub = sub || "status";
      if (smSub === "status") {
        const status = await getSupermemoryStatus(token, projectPath || null);
        return { handled: true, reply: `configured: ${status.configured}` };
      }
      if (smSub === "search") {
        const query = subArg;
        if (!query) {
          return { handled: true, reply: "Usage: /supermemory search <query>" };
        }
        const result = await searchSupermemory(token, query, projectPath || null);
        const lines = (result.results || []).map((item) => `[${item.container_tag}] ${item.memory}`);
        return { handled: true, reply: lines.length ? lines.join("\n") : "No matches." };
      }
      if (smSub === "save") {
        const content = subArg;
        if (!content) {
          return { handled: true, reply: "Usage: /supermemory save <text>" };
        }
        const saved = await saveSupermemory(token, {
          content,
          project_path: projectPath || null,
          scope: "personal",
        });
        return { handled: true, reply: `Saved (id: ${saved.id || "ok"})` };
      }
      return { handled: true, reply: "Usage: /supermemory status|search|save" };
    }

    return { handled: false };
  } catch (error) {
    return { handled: true, reply: `Command failed: ${error.message}` };
  }
}
