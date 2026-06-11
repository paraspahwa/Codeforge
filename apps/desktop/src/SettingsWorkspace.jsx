import { useEffect, useState } from "react";
import { EmptyState, Tabs } from "@codeforge/ui";
import { open } from "@tauri-apps/plugin-dialog";

import {
  API_BASE_URL,
  exportMemory,
  exportTaste,
  getAgentPreferences,
  getOidcConfig,
  getRtkStatus,
  getSupermemoryStatus,
  getTasteRules,
  getTasteStats,
  importTaste,
  listMemories,
  listSkills,
  saveMemory,
  searchMemory,
  updateAgentPreferences,
} from "./api";
import { useDesktopAuth } from "./DesktopAuthContext";
import { useDesktopNotify } from "./useDesktopNotify";

function groupSkillsByCatalog(skills) {
  const groups = [
    { id: "project", title: "Project skills", skills: [] },
    { id: "anthropic", title: "Anthropic curated", skills: [] },
    { id: "bundled", title: "CodeForge bundled", skills: [] },
  ];
  for (const skill of skills) {
    if (skill.origin === "project") {
      groups[0].skills.push(skill);
    } else if (skill.source?.includes("anthropics/skills")) {
      groups[1].skills.push(skill);
    } else {
      groups[2].skills.push(skill);
    }
  }
  return groups.filter((group) => group.skills.length > 0);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SettingsWorkspace() {
  const { userId, token } = useDesktopAuth();
  const { statusMessage, errorMessage, reportError, reportSuccess } = useDesktopNotify();

  const [projectPath, setProjectPath] = useState(import.meta.env.VITE_CODEFORGE_PROJECT_PATH || "");
  const [loading, setLoading] = useState(false);
  const [tasteStats, setTasteStats] = useState(null);
  const [tasteRules, setTasteRules] = useState([]);
  const [tasteImportJson, setTasteImportJson] = useState("");
  const [agentPrefs, setAgentPrefs] = useState(null);
  const [cavemanMode, setCavemanMode] = useState("off");
  const [enabledSkills, setEnabledSkills] = useState([]);
  const [rtkEnabled, setRtkEnabled] = useState(false);
  const [rtkStatus, setRtkStatus] = useState(null);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [memories, setMemories] = useState([]);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memorySearchHits, setMemorySearchHits] = useState([]);
  const [memorySaveText, setMemorySaveText] = useState("");
  const [supermemoryStatus, setSupermemoryStatus] = useState(null);
  const [oidcConfig, setOidcConfig] = useState(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    getOidcConfig().then(setOidcConfig).catch(() => setOidcConfig(null));
    getTasteStats(token).then(setTasteStats).catch(() => setTasteStats(null));
    getTasteRules(token)
      .then((result) => setTasteRules(result.rules ?? []))
      .catch(() => setTasteRules([]));
    getAgentPreferences(token)
      .then((prefs) => {
        setAgentPrefs(prefs);
        setCavemanMode(prefs.caveman_mode || "off");
        setEnabledSkills(prefs.enabled_skills || []);
        setRtkEnabled(Boolean(prefs.rtk_enabled));
      })
      .catch(() => setAgentPrefs(null));
    getRtkStatus(token).then(setRtkStatus).catch(() => setRtkStatus(null));
    listMemories(token, projectPath || null)
      .then((result) => setMemories(result.memories ?? []))
      .catch(() => setMemories([]));
    getSupermemoryStatus(token, projectPath || null)
      .then(setSupermemoryStatus)
      .catch(() => setSupermemoryStatus(null));
    listSkills(token, projectPath || null)
      .then((result) => setAvailableSkills(result.skills ?? []))
      .catch(() => setAvailableSkills([]));
  }, [token, projectPath]);

  async function handlePickProjectPath() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setProjectPath(selected);
    }
  }

  function toggleEnabledSkill(skillName) {
    setEnabledSkills((current) =>
      current.includes(skillName) ? current.filter((item) => item !== skillName) : [...current, skillName],
    );
  }

  async function handleSaveAgentPreferences(event) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setLoading(true);
    reportError("");
    try {
      const prefs = await updateAgentPreferences(token, {
        caveman_mode: cavemanMode,
        enabled_skills: enabledSkills,
        rtk_enabled: rtkEnabled,
      });
      setAgentPrefs(prefs);
      setRtkStatus(await getRtkStatus(token));
      reportSuccess("Token saver preferences saved");
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImportTaste(event) {
    event.preventDefault();
    if (!token || !tasteImportJson.trim()) {
      reportError("Paste a taste export JSON payload first");
      return;
    }
    setLoading(true);
    reportError("");
    try {
      const pack = JSON.parse(tasteImportJson);
      const result = await importTaste(token, { version: pack.version || 1, rules: pack.rules || [] });
      setTasteImportJson("");
      const [stats, rules] = await Promise.all([getTasteStats(token), getTasteRules(token)]);
      setTasteStats(stats);
      setTasteRules(rules.rules ?? []);
      reportSuccess(`Imported ${result.imported_rules} taste rule(s)`);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMemorySearch(event) {
    event.preventDefault();
    if (!token || !memoryQuery.trim()) {
      return;
    }
    setLoading(true);
    reportError("");
    try {
      const result = await searchMemory(token, memoryQuery.trim(), projectPath || null);
      setMemorySearchHits([
        ...(result.native || []),
        ...(result.supermemory || []).map((item) => ({
          memory_id: `sm_${item.container_tag}`,
          kind: "external",
          scope: "supermemory",
          content: item.memory,
        })),
      ]);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMemorySave(event) {
    event.preventDefault();
    if (!token || !memorySaveText.trim()) {
      return;
    }
    setLoading(true);
    reportError("");
    try {
      await saveMemory(token, {
        content: memorySaveText.trim(),
        project_path: projectPath || null,
        scope: "personal",
      });
      setMemorySaveText("");
      const result = await listMemories(token, projectPath || null);
      setMemories(result.memories ?? []);
      reportSuccess("Memory saved");
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  const profileTab = (
    <section className="card">
      <h2>Profile</h2>
      <p className="muted small">User: {userId || "not signed in"}</p>
      <p className="muted small">API: {API_BASE_URL}</p>
      <label htmlFor="settings-project-path">Default project path</label>
      <div className="button-row">
        <input
          id="settings-project-path"
          value={projectPath}
          onChange={(event) => setProjectPath(event.target.value)}
          disabled={loading}
        />
        <button type="button" onClick={handlePickProjectPath} disabled={loading}>
          Pick folder
        </button>
      </div>
      <p className="muted small">Used for memory scope, skills discovery, and slash commands.</p>
    </section>
  );

  const tokenSaverTab = !token ? (
    <EmptyState title="Sign in required" description="Token saver settings need authentication." />
  ) : (
    <section className="card">
      <h2>Token Saver &amp; Skills</h2>
      <p className="muted small">Caveman compresses prose; RTK compresses shell output. Toggle Anthropic and bundled skills.</p>
      <form onSubmit={handleSaveAgentPreferences}>
        <label htmlFor="caveman-mode">Caveman intensity</label>
        <select
          id="caveman-mode"
          value={cavemanMode}
          onChange={(event) => setCavemanMode(event.target.value)}
          disabled={loading}
        >
          {(agentPrefs?.available_caveman_modes || ["off", "lite", "full", "ultra"]).map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
        <div className="session-list mt-6">
          {availableSkills.length === 0 ? (
            <EmptyState title="No skills found" description="Add .codeforge/skills/*/SKILL.md to your project." />
          ) : (
            groupSkillsByCatalog(availableSkills).map((group) => (
              <div key={group.id} className="mt-6">
                <h4>{group.title}</h4>
                {group.skills.map((skill) => (
                  <label className="session-row" key={skill.name} style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={enabledSkills.includes(skill.name)}
                      onChange={() => toggleEnabledSkill(skill.name)}
                      disabled={loading || skill.name === "caveman"}
                    />{" "}
                    <strong>{skill.name}</strong>
                    <div className="muted small">{skill.description}</div>
                  </label>
                ))}
              </div>
            ))
          )}
        </div>
        <h3 className="mt-8">RTK shell compression</h3>
        <label className="session-row" style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={rtkEnabled}
            onChange={(event) => setRtkEnabled(event.target.checked)}
            disabled={loading || !rtkStatus?.binary_available}
          />{" "}
          Enable RTK for sandboxed shell commands
        </label>
        {rtkStatus ? (
          <p className="muted small">
            Binary: {rtkStatus.binary_available ? "available" : "not installed"} | Effective:{" "}
            {rtkStatus.effective_enabled ? "on" : "off"}
          </p>
        ) : null}
        <button type="submit" className="mt-6" disabled={loading}>
          Save preferences
        </button>
      </form>
    </section>
  );

  const memoryTab = !token ? (
    <EmptyState title="Sign in required" description="Memory settings need authentication." />
  ) : (
    <section className="card">
      <h2>Agent Memory</h2>
      {supermemoryStatus ? (
        <p className="muted small">
          Supermemory: {supermemoryStatus.configured ? "connected" : "not configured"} | Tag:{" "}
          {supermemoryStatus.personal_container_tag}
        </p>
      ) : null}
      <form onSubmit={handleMemorySearch}>
        <label htmlFor="memory-query">Search</label>
        <input
          id="memory-query"
          value={memoryQuery}
          onChange={(event) => setMemoryQuery(event.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !memoryQuery.trim()}>
          Search
        </button>
      </form>
      {memorySearchHits.length > 0 ? (
        <div className="session-list mt-6">
          {memorySearchHits.map((item) => (
            <div className="session-row" key={item.memory_id}>
              <strong>
                {item.kind}/{item.scope}
              </strong>
              <div className="muted small">{item.content}</div>
            </div>
          ))}
        </div>
      ) : null}
      <form onSubmit={handleMemorySave} className="mt-8">
        <label htmlFor="memory-save">Save memory</label>
        <textarea
          id="memory-save"
          rows={3}
          value={memorySaveText}
          onChange={(event) => setMemorySaveText(event.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !memorySaveText.trim()}>
          Save
        </button>
      </form>
      <button
        type="button"
        className="mt-6"
        disabled={loading}
        onClick={async () => {
          try {
            downloadJson("codeforge-memory-export.json", await exportMemory(token));
            reportSuccess("Memory pack exported");
          } catch (error) {
            reportError(error.message);
          }
        }}
      >
        Export memories
      </button>
      <div className="session-list mt-8">
        {memories.length === 0 ? (
          <EmptyState title="No memories yet" description="Use /memory save or approve architectural proposals." />
        ) : (
          memories.map((item) => (
            <div className="session-row" key={item.memory_id}>
              <strong>
                {item.kind}/{item.scope}
              </strong>
              <div className="muted small">{item.content}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );

  const tasteTab = !token ? (
    <EmptyState title="Sign in required" description="Taste settings need authentication." />
  ) : (
    <section className="card">
      <h2>Coding Taste</h2>
      {tasteStats ? (
        <div className="preview-box">
          <p>Active rules: {tasteStats.active_rules}</p>
          <p>Rejections: {tasteStats.rejections} | Approvals: {tasteStats.approvals}</p>
        </div>
      ) : null}
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          try {
            downloadJson("codeforge-taste-export.json", await exportTaste(token));
            reportSuccess("Taste pack exported");
          } catch (error) {
            reportError(error.message);
          }
        }}
      >
        Export taste pack
      </button>
      <div className="session-list mt-8">
        {tasteRules.length === 0 ? (
          <EmptyState title="No taste rules yet" description="Approve/reject proposals with notes to teach preferences." />
        ) : (
          tasteRules.map((rule) => (
            <div className="session-row" key={rule.rule_id}>
              <strong>Weight {rule.weight}</strong>
              <div className="muted small">{rule.rule_text}</div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleImportTaste} className="mt-8">
        <label htmlFor="taste-import">Import taste pack (JSON)</label>
        <textarea
          id="taste-import"
          rows={6}
          value={tasteImportJson}
          onChange={(event) => setTasteImportJson(event.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !tasteImportJson.trim()}>
          Import
        </button>
      </form>
    </section>
  );

  const ssoTab = (
    <section className="card">
      <h2>SSO / OIDC</h2>
      <p className="muted small">
        Desktop callback: register <code>http://localhost:1420/auth/callback</code> (dev) or your packaged app URI with
        the IdP. API secrets: <code>CODEFORGE_OIDC_*</code> in ECS SSM — see DEPLOYMENT_RUNBOOK.md.
      </p>
      {oidcConfig ? (
        <ul className="muted small">
          <li>Enabled: {oidcConfig.enabled ? "yes" : "no"}</li>
          <li>Issuer: {oidcConfig.issuer || "(not set)"}</li>
          <li>Client ID: {oidcConfig.client_id ? `${oidcConfig.client_id.slice(0, 8)}…` : "(not set)"}</li>
          <li>Scopes: {oidcConfig.scopes}</li>
        </ul>
      ) : (
        <EmptyState title="OIDC config unavailable" description="Could not load /api/v1/auth/oidc/config." />
      )}
    </section>
  );

  return (
    <main className="desktop-main settings-workspace">
      <h1>Settings</h1>
      <p className="muted">Phases 7–10: taste, memory, token saver, skills, RTK, Supermemory status, and SSO checklist.</p>
      {statusMessage ? <div className="status success">{statusMessage}</div> : null}
      {errorMessage ? <div className="status error">{errorMessage}</div> : null}
      <Tabs
        defaultTab="profile"
        tabs={[
          { id: "profile", label: "Profile", content: profileTab },
          { id: "token-saver", label: "Token Saver", content: tokenSaverTab },
          { id: "memory", label: "Memory", content: memoryTab },
          { id: "taste", label: "Taste", content: tasteTab },
          { id: "sso", label: "SSO", content: ssoTab },
        ]}
      />
    </main>
  );
}
