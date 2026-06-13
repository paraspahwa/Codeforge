import {
  commitGitChanges,
  compactWorkflow,
  createPullRequest,
  createWorkflowPlan,
  executeWorkflowPlan,
  exportMemory,
  exportTaste,
  getAgentPreferences,
  getContextStack,
  getGitDiff,
  getGitLog,
  getGitStatus,
  getRtkStatus,
  getSupermemoryStatus,
  getTasteRules,
  getTasteStats,
  gitFetch,
  gitPull,
  gitPush,
  listCheckpoints,
  listMemories,
  listSkills,
  listWorkspaceFiles,
  rewindCheckpoint,
  rollbackWorkflowPlan,
  saveMemory,
  scrapeCoworkData,
  searchMemory,
  searchSupermemory,
  searchSymbols,
  searchWeb,
  saveSupermemory,
  stageGitFiles,
  streamShellCommand,
  updateAgentPreferences,
} from "./api";

const HELP_TEXT = `CodeForge workspace commands:

/code & navigation
/files list — list workspace files
/symbol <name> — find functions/classes across the repo
/file <path> — set active file for the next edit

/git status|diff|log|stage|commit — git operations
/git resolve-guide <branch> — merge conflict guide

/run <command> — sandboxed shell (pytest, npm test, rg, git status…)
/plan <file1> <file2> — multi-file edit plan
/plan run — execute active plan
/plan rollback — rollback active plan

/search <query> — web search for docs & errors
/scrape <url> <prompt> — fetch & extract page content

/mode plan|execute|off — plan mode (review before writes)
/context — show active context stack
/context add <path> — pin file to session context
/compact — summarize conversation context
/pr create <title> — create GitHub/GitLab pull request
/rewind <checkpoint_id> — restore files to checkpoint

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

/**
 * @returns {Promise<{ handled: boolean, reply?: string, activeFile?: string, activePlanId?: string, planMode?: boolean, attachedFiles?: string[] }>}
 */
export async function runSlashCommand({ text, token, projectPath, sessionId, planMode = false, attachedFiles = [] }) {
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

    if (name === "files") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const action = sub || "list";
      if (action === "list") {
        const result = await listWorkspaceFiles(token, sessionId);
        const lines = (result.files || []).slice(0, 40);
        return {
          handled: true,
          reply: lines.length ? lines.join("\n") : "No files found in workspace.",
        };
      }
      return { handled: true, reply: "Usage: /files list" };
    }

    if (name === "symbol") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const query = argLine.trim();
      if (!query) {
        return { handled: true, reply: "Usage: /symbol <name>" };
      }
      const result = await searchSymbols(token, sessionId, query);
      const lines = (result.matches || []).slice(0, 15).map(
        (item) => `${item.kind} ${item.symbol} — ${item.file}:${item.line}`,
      );
      if (result.file_hits?.length) {
        lines.push("", "File hits:", ...result.file_hits.slice(0, 8));
      }
      return { handled: true, reply: lines.length ? lines.join("\n") : "No symbols matched." };
    }

    if (name === "search") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const query = argLine.trim();
      if (!query) {
        return { handled: true, reply: "Usage: /search <query>" };
      }
      const result = await searchWeb(token, sessionId, query);
      const lines = (result.results || []).map(
        (item, index) => `${index + 1}. ${item.title}\n   ${item.url}${item.snippet ? `\n   ${item.snippet}` : ""}`,
      );
      return { handled: true, reply: lines.length ? lines.join("\n\n") : "No web results." };
    }

    if (name === "scrape") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const [url, ...promptParts] = rest;
      const scrapePrompt = promptParts.join(" ").trim() || "Summarize the technical content.";
      if (!url) {
        return { handled: true, reply: "Usage: /scrape <url> <prompt>" };
      }
      const result = await scrapeCoworkData(token, {
        session_id: sessionId,
        url,
        scrape_prompt: scrapePrompt,
        approved: true,
      });
      return {
        handled: true,
        reply: result.summary || result.excerpt || "Scrape completed.",
      };
    }

    if (name === "run") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const command = argLine.trim();
      if (!command) {
        return { handled: true, reply: "Usage: /run <command>" };
      }
      const chunks = [];
      for await (const evt of streamShellCommand(token, sessionId, { command })) {
        if (evt.type === "shell_output") {
          chunks.push(evt.payload?.chunk || evt.payload?.output || "");
        }
        if (evt.type === "shell_result") {
          chunks.push(`\n[exit ${evt.payload?.exit_code ?? "?"}]`);
        }
      }
      return { handled: true, reply: chunks.join("").trim() || "Command finished with no output." };
    }

    if (name === "git") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const subcommand = sub || "status";
      if (subcommand === "status") {
        const status = await getGitStatus(token, sessionId);
        const lines = [`${status.branch} | ${status.summary}`];
        (status.changed_files || []).slice(0, 8).forEach((item) => lines.push(`${item.status} ${item.path}`));
        (status.untracked_files || []).slice(0, 5).forEach((path) => lines.push(`?? ${path}`));
        return { handled: true, reply: lines.join("\n") };
      }
      if (subcommand === "diff") {
        const diff = await getGitDiff(token, sessionId, subArg || null);
        return { handled: true, reply: diff.diff || diff.stat || "No diff." };
      }
      if (subcommand === "log") {
        const log = await getGitLog(token, sessionId, Number.parseInt(rest[1] || "10", 10) || 10);
        const lines = (log.commits || []).slice(0, 8).map((entry) => `${entry.commit_id} ${entry.message}`);
        return { handled: true, reply: lines.length ? lines.join("\n") : "No commits." };
      }
      if (subcommand === "stage") {
        const target = subArg;
        const payload =
          target === "--all" || target === "all"
            ? { all_files: true, paths: [] }
            : { all_files: false, paths: target ? target.split(/\s+/).filter(Boolean) : [] };
        const result = await stageGitFiles(token, sessionId, payload);
        return { handled: true, reply: `Staged: ${(result.paths || []).join(", ") || "nothing"}` };
      }
      if (subcommand === "commit") {
        const message = subArg;
        if (!message) {
          return { handled: true, reply: "Usage: /git commit <message>" };
        }
        const result = await commitGitChanges(token, sessionId, message);
        return { handled: true, reply: `Committed: ${result.message}` };
      }
      return {
        handled: true,
        reply: "Usage: /git status|diff|log|stage [paths|--all]|commit <message>",
      };
    }

    if (name === "plan") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const action = sub || "";
      if (action === "run") {
        return { handled: true, reply: "Use the Workflows tab → Run Plan, or pass a plan id from Create Plan." };
      }
      if (action === "rollback") {
        return { handled: true, reply: "Use the Workflows tab → Rollback for the active plan." };
      }
      const targets = rest.filter((item) => item !== "run" && item !== "rollback");
      if (!targets.length) {
        return { handled: true, reply: "Usage: /plan <file1> <file2> ..." };
      }
      const plan = await createWorkflowPlan(sessionId, token, targets);
      return {
        handled: true,
        reply: `Plan ${plan.plan_id} ready for: ${plan.targets.join(", ")}`,
        activePlanId: plan.plan_id,
      };
    }

    if (name === "mode") {
      const modeArg = sub || "status";
      if (modeArg === "plan") {
        return { handled: true, reply: "Plan mode enabled — agent will propose changes without writing.", planMode: true };
      }
      if (modeArg === "execute" || modeArg === "off") {
        return {
          handled: true,
          reply: modeArg === "execute" ? "Plan mode off — ready to execute." : "Plan mode disabled.",
          planMode: false,
        };
      }
      return {
        handled: true,
        reply: `Plan mode is ${planMode ? "on" : "off"}. Usage: /mode plan|execute|off`,
        planMode,
      };
    }

    if (name === "context") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      if (sub === "add") {
        const path = subArg.trim();
        if (!path) {
          return { handled: true, reply: "Usage: /context add <path>" };
        }
        const next = [...new Set([...attachedFiles, path])];
        return {
          handled: true,
          reply: `Pinned ${path} to session context.`,
          activeFile: path,
          attachedFiles: next,
        };
      }
      const stack = await getContextStack(token, sessionId);
      const lines = [
        `Project memory: ${(stack.project_memory || "").slice(0, 120) || "none"}`,
        `Skills: ${(stack.skills || []).join(", ") || "none"}`,
        `Packs: ${(stack.packs || []).join(", ") || "none"}`,
        `Attached files: ${attachedFiles.join(", ") || "none"}`,
      ];
      return { handled: true, reply: lines.join("\n") };
    }

    if (name === "compact") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const result = await compactWorkflow(sessionId, token);
      return { handled: true, reply: result.summary || result.message || "Context compacted." };
    }

    if (name === "pr") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      if (sub === "create") {
        const title = subArg || "CodeForge changes";
        const result = await createPullRequest(token, sessionId, {
          title,
          body: "Automated PR from CodeForge session.",
          provider: "github",
        });
        return { handled: true, reply: result.url || result.message || "PR created." };
      }
      return { handled: true, reply: "Usage: /pr create <title>" };
    }

    if (name === "rewind") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const checkpointId = argLine.trim();
      if (!checkpointId) {
        const rows = await listCheckpoints(token, sessionId);
        const lines = (rows.checkpoints || []).map(
          (item) => `${item.checkpoint_id} — ${item.label} (${item.created_at})`,
        );
        return {
          handled: true,
          reply: lines.length ? lines.join("\n") : "No checkpoints yet.",
        };
      }
      const result = await rewindCheckpoint(token, sessionId, checkpointId);
      return {
        handled: true,
        reply: `Rewound to ${result.label || checkpointId}. Restored: ${(result.restored_paths || []).join(", ") || "files"}`,
      };
    }

    if (name === "git" && sub === "push") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const result = await gitPush(token, sessionId, { remote: "origin", branch: subArg || "" });
      return { handled: true, reply: result.output || result.message || "Push completed." };
    }

    if (name === "git" && sub === "pull") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const result = await gitPull(token, sessionId, { remote: "origin", branch: subArg || "" });
      return { handled: true, reply: result.output || result.message || "Pull completed." };
    }

    if (name === "git" && sub === "fetch") {
      if (!sessionId) {
        return { handled: true, reply: "Open a session first." };
      }
      const result = await gitFetch(token, sessionId, subArg || "origin");
      return { handled: true, reply: result.output || "Fetch completed." };
    }

    if (name === "memory") {
      const action = sub || "list";
      if (action === "list") {
        const result = await listMemories(token, projectPath || null);
        const lines = (result.memories || []).map(
          (item) => `[${item.kind}/${item.scope}] ${item.content.slice(0, 120)}`,
        );
        return {
          handled: true,
          reply: lines.length ? lines.join("\n") : "No memories saved yet.",
        };
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
        return {
          handled: true,
          reply: lines.length ? lines.join("\n") : "No matches.",
        };
      }
      if (action === "save") {
        const content = subArg || argLine.replace(/^save\s*/i, "").trim();
        if (!content) {
          return { handled: true, reply: "Usage: /memory save <text>" };
        }
        const saved = await saveMemory(token, {
          content,
          project_path: projectPath || null,
          scope: "personal",
        });
        return { handled: true, reply: `Saved ${saved.memory_id}:\n${saved.content}` };
      }
      if (action === "export") {
        const pack = await exportMemory(token);
        const blob = JSON.stringify(pack, null, 2);
        return {
          handled: true,
          reply: `Exported ${pack.memories?.length || 0} memories. Copy JSON from browser download in Settings → Memory, or use Settings export button.`,
        };
      }
      return { handled: true, reply: "Usage: /memory list|search|save|export" };
    }

    if (name === "taste") {
      const action = sub || "stats";
      if (action === "stats") {
        const stats = await getTasteStats(token);
        return {
          handled: true,
          reply: [
            `sessions_with_feedback: ${stats.sessions_with_feedback}`,
            `total_events: ${stats.total_events}`,
            `rejections: ${stats.rejections}`,
            `approvals: ${stats.approvals}`,
            `active_rules: ${stats.active_rules}`,
          ].join("\n"),
        };
      }
      if (action === "rules") {
        const result = await getTasteRules(token);
        const lines = (result.rules || []).map((rule) => `[w${rule.weight}] ${rule.rule_text}`);
        return {
          handled: true,
          reply: lines.length ? lines.join("\n") : result.taste_md || "No taste rules yet.",
        };
      }
      if (action === "export") {
        const pack = await exportTaste(token);
        return {
          handled: true,
          reply: `Taste pack has ${pack.rules?.length || 0} rules. Use Settings → Taste for import/export UI.`,
        };
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
            `token_saver_enabled: ${prefs.token_saver_enabled}`,
            `enabled_skills: ${(prefs.enabled_skills || []).join(", ") || "none"}`,
          ].join("\n"),
        };
      }
      if (modeArg === "skills") {
        const result = await listSkills(token, projectPath || null);
        const lines = (result.skills || []).map(
          (skill) => `${skill.name} [${skill.origin}] — ${(skill.description || "").slice(0, 80)}`,
        );
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
      if (rtkSub === "status" || rtkSub === "gain") {
        const status = await getRtkStatus(token);
        const stats = status.last_stats || {};
        return {
          handled: true,
          reply: [
            `binary_available: ${status.binary_available}`,
            `effective_enabled: ${status.effective_enabled}`,
            `last_command: ${stats.command || "none"}`,
            `savings_pct: ${stats.savings_pct ?? 0}`,
          ].join("\n"),
        };
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
        return {
          handled: true,
          reply: [
            `configured: ${status.configured}`,
            `personal_tag: ${status.personal_container_tag}`,
            `requires_pro: ${status.requires_pro}`,
          ].join("\n"),
        };
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
        return { handled: true, reply: `Saved to Supermemory (id: ${saved.id || "ok"})` };
      }
      return { handled: true, reply: "Usage: /supermemory status|search|save" };
    }

    return { handled: false };
  } catch (error) {
    return { handled: true, reply: `Command failed: ${error.message}` };
  }
}
