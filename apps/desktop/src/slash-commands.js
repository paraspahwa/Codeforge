import {
  exportMemory,
  exportTaste,
  getAgentPreferences,
  getRtkStatus,
  getSupermemoryStatus,
  getTasteRules,
  getTasteStats,
  listMemories,
  listSkills,
  saveMemory,
  searchMemory,
  searchSupermemory,
  saveSupermemory,
  updateAgentPreferences,
} from "./api";

const HELP_TEXT = `Desktop slash commands:

/memory list|search|save|export
/taste stats|rules|export
/caveman off|lite|full|ultra|status|skills
/rtk on|off|status
/supermemory status|search|save
/help — this message

Open Settings for full import/export and skill toggles.`;

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

export async function runSlashCommand({ text, token, projectPath }) {
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
        return {
          handled: true,
          reply: `Exported ${pack.memories?.length || 0} memories. Use Settings → Memory → Export.`,
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
          reply: `Taste pack has ${pack.rules?.length || 0} rules. Use Settings → Taste for export.`,
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
