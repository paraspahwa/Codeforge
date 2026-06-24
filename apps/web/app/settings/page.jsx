"use client";

import { useEffect, useState } from "react";
import { EmptyState, Skeleton, Tabs } from "@codeforge/ui";

import {
  createContextPack,
  createMcpConnector,
  exportTaste,
  exportMemory,
  getAgentPreferences,
  getDeployReadiness,
  getAgentReachStatus,
  getHermesStatus,
  getOidcConfig,
  getRtkStatus,
  getSupermemoryStatus,
  getTasteRules,
  getTasteStats,
  importTaste,
  listContextPacks,
  listMemories,
  listMcpConnectors,
  listSkills,
  saveMemory,
  searchMemory,
  updateAgentPreferences,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function groupSkillsByCatalog(skills) {
  const groups = [
    {
      id: "project",
      title: "Project skills",
      description: "From your repo .codeforge/skills/ — override bundled skills with the same name.",
      skills: [],
    },
    {
      id: "anthropic",
      title: "Anthropic curated",
      description: "Adapted from anthropics/skills (Apache-2.0). Instructions-only; no bundled scripts.",
      skills: [],
    },
    {
      id: "bundled",
      title: "CodeForge bundled",
      description: "Shipped with CodeForge (caveman, pr-conventions, etc.).",
      skills: [],
    },
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

export default function SettingsPage() {
  const { userId, token, ready } = useAuth();
  const toast = useToast();

  const [projectPath, setProjectPath] = useState("");
  const [packs, setPacks] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(false);

  const [packTitle, setPackTitle] = useState("");
  const [packSummary, setPackSummary] = useState("");
  const [packSnippets, setPackSnippets] = useState("");

  const [connectorName, setConnectorName] = useState("");
  const [connectorEndpoint, setConnectorEndpoint] = useState("");
  const [connectorTransport, setConnectorTransport] = useState("http");
  const [connectorTools, setConnectorTools] = useState("");
  const [deployReadiness, setDeployReadiness] = useState(null);
  const [agentReachStatus, setAgentReachStatus] = useState(null);
  const [tasteStats, setTasteStats] = useState(null);
  const [tasteRules, setTasteRules] = useState([]);
  const [tasteMd, setTasteMd] = useState("");
  const [tasteImportJson, setTasteImportJson] = useState("");
  const [agentPrefs, setAgentPrefs] = useState(null);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [cavemanMode, setCavemanMode] = useState("off");
  const [enabledSkills, setEnabledSkills] = useState([]);
  const [rtkEnabled, setRtkEnabled] = useState(false);
  const [rtkStatus, setRtkStatus] = useState(null);
  const [agentEngine, setAgentEngine] = useState("codeforge");
  const [permissionMode, setPermissionMode] = useState("auto_safe");
  const [planModeDefault, setPlanModeDefault] = useState(false);
  const [hermesStatus, setHermesStatus] = useState(null);
  const [memories, setMemories] = useState([]);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memorySearchHits, setMemorySearchHits] = useState([]);
  const [memorySaveText, setMemorySaveText] = useState("");
  const [supermemoryStatus, setSupermemoryStatus] = useState(null);
  const [oidcConfig, setOidcConfig] = useState(null);

  useEffect(() => {
    setProjectPath(localStorage.getItem("codeforge_project_path") || "");
  }, []);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    listContextPacks(token)
      .then((result) => setPacks(result.packs ?? []))
      .catch(() => undefined);
    listMcpConnectors(token)
      .then((result) => setConnectors(result.connectors ?? []))
      .catch(() => undefined);
    getDeployReadiness(true)
      .then(setDeployReadiness)
      .catch(() => setDeployReadiness(null));
    getAgentReachStatus()
      .then(setAgentReachStatus)
      .catch(() => setAgentReachStatus(null));
    getOidcConfig()
      .then(setOidcConfig)
      .catch(() => setOidcConfig(null));
    getTasteStats(token)
      .then(setTasteStats)
      .catch(() => setTasteStats(null));
    getTasteRules(token)
      .then((result) => {
        setTasteRules(result.rules ?? []);
        setTasteMd(result.taste_md ?? "");
      })
      .catch(() => {
        setTasteRules([]);
        setTasteMd("");
      });
    getAgentPreferences(token)
      .then((prefs) => {
        setAgentPrefs(prefs);
        setCavemanMode(prefs.caveman_mode || "off");
        setEnabledSkills(prefs.enabled_skills || []);
        setRtkEnabled(Boolean(prefs.rtk_enabled));
        setAgentEngine(prefs.agent_engine || "codeforge");
        setPermissionMode(prefs.permission_mode || "auto_safe");
        setPlanModeDefault(Boolean(prefs.plan_mode_default));
      })
      .catch(() => setAgentPrefs(null));
    getRtkStatus(token)
      .then(setRtkStatus)
      .catch(() => setRtkStatus(null));
    getHermesStatus(token)
      .then(setHermesStatus)
      .catch(() => setHermesStatus(null));
    listMemories(token, projectPath || null)
      .then((result) => setMemories(result.memories ?? []))
      .catch(() => setMemories([]));
    getSupermemoryStatus(token, projectPath || null)
      .then(setSupermemoryStatus)
      .catch(() => setSupermemoryStatus(null));
    listSkills(token, projectPath || null)
      .then((result) => setAvailableSkills(result.skills ?? []))
      .catch(() => setAvailableSkills([]));
  }, [ready, token, projectPath]);

  async function refreshTaste() {
    if (!token) {
      return;
    }
    const [stats, rules] = await Promise.all([getTasteStats(token), getTasteRules(token)]);
    setTasteStats(stats);
    setTasteRules(rules.rules ?? []);
    setTasteMd(rules.taste_md ?? "");
  }

  function handleSaveProjectPath() {
    localStorage.setItem("codeforge_project_path", projectPath.trim());
    toast.push("Default project path saved", "success");
  }

  async function handleCreatePack(event) {
    event.preventDefault();
    const snippets = packSnippets
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (snippets.length === 0) {
      toast.push("Add at least one snippet line");
      return;
    }
    setLoading(true);
    try {
      await createContextPack(token, {
        title: packTitle.trim(),
        summary: packSummary.trim(),
        tags: [],
        snippets,
      });
      const result = await listContextPacks(token);
      setPacks(result.packs ?? []);
      setPackTitle("");
      setPackSummary("");
      setPackSnippets("");
      toast.push("Context pack created", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportTaste() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const pack = await exportTaste(token);
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "codeforge-taste-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      toast.push("Taste pack exported", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAgentPreferences(event) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const prefs = await updateAgentPreferences(token, {
        caveman_mode: cavemanMode,
        enabled_skills: enabledSkills,
        rtk_enabled: rtkEnabled,
        agent_engine: agentEngine,
        permission_mode: permissionMode,
        plan_mode_default: planModeDefault,
      });
      setAgentPrefs(prefs);
      const [status, hermes] = await Promise.all([getRtkStatus(token), getHermesStatus(token)]);
      setRtkStatus(status);
      setHermesStatus(hermes);
      toast.push("Token saver preferences saved", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleEnabledSkill(skillName) {
    setEnabledSkills((current) =>
      current.includes(skillName) ? current.filter((item) => item !== skillName) : [...current, skillName],
    );
  }

  async function handleImportTaste(event) {
    event.preventDefault();
    if (!tasteImportJson.trim()) {
      toast.push("Paste a taste export JSON payload first");
      return;
    }
    setLoading(true);
    try {
      const pack = JSON.parse(tasteImportJson);
      const result = await importTaste(token, {
        version: pack.version || 1,
        rules: pack.rules || [],
      });
      setTasteImportJson("");
      await refreshTaste();
      toast.push(`Imported ${result.imported_rules} taste rule(s)`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateConnector(event) {
    event.preventDefault();
    const tools = connectorTools
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (tools.length === 0) {
      toast.push("List at least one tool name");
      return;
    }
    setLoading(true);
    try {
      await createMcpConnector(token, {
        name: connectorName.trim(),
        description: "",
        endpoint: connectorEndpoint.trim(),
        transport: connectorTransport,
        tools,
      });
      const result = await listMcpConnectors(token);
      setConnectors(result.connectors ?? []);
      setConnectorName("");
      setConnectorEndpoint("");
      setConnectorTools("");
      toast.push("MCP connector created", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <section className="panel">
        <Skeleton style={{ height: "2rem", marginBottom: "1rem" }} />
        <Skeleton style={{ height: "10rem" }} />
      </section>
    );
  }

  const profileTab = (
      <section className="panel">
        <h2>Profile</h2>
        <p className="small">User: {userId || "not logged in"}</p>
        <p className="small">API base: {API_BASE}</p>
      </section>
  );

  const projectTab = (
      <section className="panel">
        <h2>Default Project Path</h2>
        <input
          aria-label="Default project path"
          value={projectPath}
          placeholder="c:/path/to/your/project"
          onChange={(event) => setProjectPath(event.target.value)}
        />
        <div className="mt-6">
          <button type="button" onClick={handleSaveProjectPath} disabled={!projectPath.trim()}>
            Save
          </button>
        </div>
      </section>
  );

  const authTab = (
    <section className="panel">
      <h2>SSO / OIDC</h2>
      <p className="small">
        Production SSO uses OpenID Connect. Register the web redirect URI at your IdP and store secrets in ECS SSM
        (<code>CODEFORGE_OIDC_*</code>). See <code>DEPLOYMENT_RUNBOOK.md</code> and{" "}
        <code>docs/deployment-assets-setup.md</code>.
      </p>
      {oidcConfig ? (
        <ul className="small mt-6">
          <li>
            <strong>Enabled:</strong> {oidcConfig.enabled ? "yes" : "no"}
          </li>
          <li>
            <strong>Issuer:</strong> {oidcConfig.issuer || "(not set)"}
          </li>
          <li>
            <strong>Client ID:</strong> {oidcConfig.client_id ? `${oidcConfig.client_id.slice(0, 8)}…` : "(not set)"}
          </li>
          <li>
            <strong>Redirect URI:</strong> {oidcConfig.redirect_uri || `${API_BASE.replace(/:\d+$/, ":3000")}/auth/callback`}
          </li>
          <li>
            <strong>Scopes:</strong> {oidcConfig.scopes}
          </li>
        </ul>
      ) : (
        <EmptyState title="OIDC config unavailable" description="Could not load /api/v1/auth/oidc/config." />
      )}
      {deployReadiness ? (
        <>
          <h3 className="mt-8">OIDC readiness checks</h3>
          <ul className="small">
            {(deployReadiness.checks || [])
              .filter((check) => check.name.includes("oidc") || check.name.includes("dev_login"))
              .map((check) => (
                <li key={check.name}>
                  {check.ok ? "✓" : "✗"} {check.name}
                  {check.detail ? ` — ${check.detail}` : ""}
                </li>
              ))}
          </ul>
        </>
      ) : null}
    </section>
  );

  const deployTab = (
      <section className="panel">
        <h2>Deploy readiness</h2>
        <p className="small">Runtime configuration checks for production rollout.</p>
        {deployReadiness ? (
          <>
            <p className="small">
              Status: <strong>{deployReadiness.ready ? "ready" : "blocked"}</strong>
              {deployReadiness.oidc_enabled ? " · OIDC enabled" : " · OIDC disabled"}
            </p>
            <ul className="small">
              {deployReadiness.checks?.map((check) => (
                <li key={check.name}>
                  {check.ok ? "✓" : "✗"} {check.name}
                  {check.detail ? ` — ${check.detail}` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState title="Deploy readiness unavailable" description="Could not load runtime checks." />
        )}
        <h3 style={{ marginTop: "1.5rem" }}>Agent Reach (server channels)</h3>
        <p className="small">
          Doctor-style status for web, YouTube, RSS, GitHub, Exa, Bilibili, and Firecrawl. Enable the{" "}
          <strong>agent-reach</strong> skill and MCP connector for full research flows.
        </p>
        {agentReachStatus ? (
          <>
            <p className="small">
              Status: <strong>{agentReachStatus.status}</strong> · {agentReachStatus.healthy_count}/
              {agentReachStatus.total_channels} channels healthy
            </p>
            <ul className="small">
              {Object.entries(agentReachStatus.channels || {}).map(([name, row]) => (
                <li key={name}>
                  {row.ok ? "✓" : row.disabled ? "○" : "✗"} {name}
                  {row.backend ? ` (${row.backend})` : ""}
                  {row.error ? ` — ${row.error}` : ""}
                  {row.version ? ` — v${row.version}` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="small muted">Agent Reach status unavailable.</p>
        )}
      </section>
  );

  const contextTab = !token ? (
    <EmptyState title="Sign in required" description="Context packs require an authenticated session." />
  ) : (
    <section className="panel">
      <h2>Context Packs</h2>
      <form onSubmit={handleCreatePack}>
        <label className="small" htmlFor="pack-title">
          Title
        </label>
        <input
          id="pack-title"
          value={packTitle}
          onChange={(event) => setPackTitle(event.target.value)}
          disabled={loading}
        />
        <label className="small" htmlFor="pack-summary">
          Summary
        </label>
        <input
          id="pack-summary"
          value={packSummary}
          onChange={(event) => setPackSummary(event.target.value)}
          disabled={loading}
        />
        <label className="small" htmlFor="pack-snippets">
          Snippets (one per line)
        </label>
        <textarea
          id="pack-snippets"
          rows={4}
          value={packSnippets}
          onChange={(event) => setPackSnippets(event.target.value)}
          disabled={loading}
        />
        <div className="mt-6">
          <button type="submit" disabled={loading}>
            Create Pack
          </button>
        </div>
      </form>
      <div className="session-list mt-8">
        {packs.length === 0 ? <EmptyState title="No context packs" description="Create a pack to reuse snippets." /> : null}
        {packs.map((pack) => (
          <div className="benchmark-row" key={pack.pack_id}>
            <strong>{pack.title || pack.pack_id}</strong>
            <div className="small">{pack.summary}</div>
            <div className="small">
              {pack.snippets.length} snippets | attached to {pack.attached_sessions.length} sessions
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  async function handleMemorySearch(event) {
    event.preventDefault();
    if (!token || !memoryQuery.trim()) {
      return;
    }
    setLoading(true);
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
      toast.push(error.message);
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
    try {
      await saveMemory(token, {
        content: memorySaveText.trim(),
        project_path: projectPath || null,
        scope: "personal",
      });
      setMemorySaveText("");
      const result = await listMemories(token, projectPath || null);
      setMemories(result.memories ?? []);
      toast.push("Memory saved", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportMemory() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const pack = await exportMemory(token);
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "codeforge-memory-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      toast.push("Memory pack exported", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  const tokenSaverTab = !token ? (
    <EmptyState title="Sign in required" description="Token saver settings require an authenticated session." />
  ) : (
    <section className="panel">
      <h2>Token Saver</h2>
      <p className="small">
        Caveman compresses assistant prose (~75%).{" "}
        <a href="https://github.com/rtk-ai/rtk" target="_blank" rel="noreferrer">
          RTK
        </a>{" "}
        compresses shell command output (pytest, git, npm test) before it reaches the agent.
      </p>
      <form onSubmit={handleSaveAgentPreferences}>
        <h3 className="mt-0">Agent engine</h3>
        <p className="small">
          CodeForge is the built-in router and proposal flow.{" "}
          <a href="https://github.com/NousResearch/hermes-agent" target="_blank" rel="noreferrer">
            Hermes Agent
          </a>{" "}
          runs as an optional sidecar when installed on the API host.
        </p>
        <label className="small" htmlFor="agent-engine">
          Engine
        </label>
        <select
          id="agent-engine"
          value={agentEngine}
          onChange={(event) => setAgentEngine(event.target.value)}
          disabled={loading || !hermesStatus?.env_enabled}
        >
          {(agentPrefs?.available_agent_engines || ["codeforge", "hermes"]).map((engine) => (
            <option key={engine} value={engine}>
              {engine}
            </option>
          ))}
        </select>
        {hermesStatus ? (
          <p className="small mt-4">
            Hermes: {hermesStatus.env_enabled ? "enabled" : "disabled (set CODEFORGE_HERMES_ENABLED)"} | Binary:{" "}
            {hermesStatus.binary_available ? "installed" : "not installed"}
            {hermesStatus.simulate_mode ? " | simulate mode on" : ""} | Effective: {hermesStatus.effective_engine}
          </p>
        ) : null}
        <h3 className="mt-8">Safety &amp; plan mode</h3>
        <label className="small" htmlFor="permission-mode">
          Permission mode
        </label>
        <select
          id="permission-mode"
          value={permissionMode}
          onChange={(event) => setPermissionMode(event.target.value)}
          disabled={loading}
        >
          {(agentPrefs?.available_permission_modes || ["ask", "auto_safe", "auto_all"]).map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
        <label className="small mt-4">
          <input
            type="checkbox"
            checked={planModeDefault}
            onChange={(event) => setPlanModeDefault(event.target.checked)}
            disabled={loading}
          />{" "}
          Enable plan mode by default (review strategy before writes)
        </label>
        <h3 className="mt-8">Caveman prose compression</h3>
        <p className="small">
          Based on{" "}
          <a href="https://github.com/JuliusBrussee/caveman" target="_blank" rel="noreferrer">
            caveman
          </a>{" "}
          (MIT). Code patches and commits stay normal.
        </p>
        <label className="small" htmlFor="caveman-mode">
          Caveman intensity
        </label>
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
        <p className="small mt-4">
          Tip: say &quot;caveman mode&quot; or &quot;less tokens&quot; in chat to trigger for one turn. Use
          &quot;stop caveman&quot; to revert.
        </p>
        <div className="session-list mt-6">
          {availableSkills.length === 0 ? (
            <EmptyState title="No skills found" description="Add .codeforge/skills/*/SKILL.md to your project." />
          ) : (
            groupSkillsByCatalog(availableSkills).map((group) => (
              <div key={group.id} className="mt-6">
                <h4>{group.title}</h4>
                <p className="small">{group.description}</p>
                {group.skills.map((skill) => (
                  <label className="benchmark-row" key={skill.name} style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={enabledSkills.includes(skill.name)}
                      onChange={() => toggleEnabledSkill(skill.name)}
                      disabled={loading || skill.name === "caveman"}
                    />{" "}
                    <strong>{skill.name}</strong>
                    {skill.license ? ` (${skill.license})` : ""}
                    <div className="small">{skill.description}</div>
                  </label>
                ))}
              </div>
            ))
          )}
        </div>
        <h3 className="mt-8">RTK shell compression</h3>
        <label className="benchmark-row" style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={rtkEnabled}
            onChange={(event) => setRtkEnabled(event.target.checked)}
            disabled={loading || !rtkStatus?.binary_available}
          />{" "}
          Enable RTK for sandboxed shell commands
        </label>
        {rtkStatus ? (
          <p className="small mt-4">
            Binary: {rtkStatus.binary_available ? "available" : "not installed"} | Effective:{" "}
            {rtkStatus.effective_enabled ? "on" : "off"}
            {rtkStatus.last_stats?.savings_pct != null
              ? ` | Last savings ~${rtkStatus.last_stats.savings_pct}%`
              : ""}
          </p>
        ) : null}
        <div className="mt-6">
          <button type="submit" disabled={loading}>
            Save token saver settings
          </button>
        </div>
      </form>
    </section>
  );

  const memoryTab = !token ? (
    <EmptyState title="Sign in required" description="Memory settings require an authenticated session." />
  ) : (
    <section className="panel">
      <h2>Agent Memory</h2>
      <p className="small">
        Native cross-session memory (Postgres + Qdrant). Optional Supermemory BYOK connects when{" "}
        <code>SUPERMEMORY_CC_API_KEY</code> is set.
      </p>
      {supermemoryStatus ? (
        <p className="small mt-4">
          Supermemory: {supermemoryStatus.configured ? "connected" : "not configured"} | Personal tag:{" "}
          {supermemoryStatus.personal_container_tag}
        </p>
      ) : null}
      <form onSubmit={handleMemorySearch} className="mt-6">
        <label className="small" htmlFor="memory-query">
          Search memories
        </label>
        <input
          id="memory-query"
          value={memoryQuery}
          onChange={(event) => setMemoryQuery(event.target.value)}
          placeholder="auth decision, pytest failures..."
          disabled={loading}
        />
        <div className="mt-6">
          <button type="submit" disabled={loading || !memoryQuery.trim()}>
            Search
          </button>
        </div>
      </form>
      {memorySearchHits.length > 0 ? (
        <div className="session-list mt-6">
          {memorySearchHits.map((item) => (
            <div className="benchmark-row" key={item.memory_id}>
              <strong>
                {item.kind}/{item.scope}
              </strong>
              <div className="small">{item.content}</div>
            </div>
          ))}
        </div>
      ) : null}
      <form onSubmit={handleMemorySave} className="mt-8">
        <label className="small" htmlFor="memory-save">
          Save memory
        </label>
        <textarea
          id="memory-save"
          rows={3}
          value={memorySaveText}
          onChange={(event) => setMemorySaveText(event.target.value)}
          placeholder="Remember: we use PGHOST env vars instead of DATABASE_URL with special chars"
          disabled={loading}
        />
        <div className="mt-6">
          <button type="submit" disabled={loading || !memorySaveText.trim()}>
            Save memory
          </button>
        </div>
      </form>
      <div className="mt-8">
        <button type="button" onClick={handleExportMemory} disabled={loading}>
          Export memories
        </button>
      </div>
      <div className="session-list mt-8">
        {memories.length === 0 ? (
          <EmptyState title="No memories yet" description="Use /memory save or approve architectural proposals." />
        ) : (
          memories.map((item) => (
            <div className="benchmark-row" key={item.memory_id}>
              <strong>
                {item.kind}/{item.scope}
              </strong>
              <div className="small">{item.content}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );

  const tasteTab = !token ? (
    <EmptyState title="Sign in required" description="Coding taste requires an authenticated session." />
  ) : (
    <section className="panel">
      <h2>Coding Taste</h2>
      <p className="small">
        Personal constraints learned from proposal approve/reject feedback. Lower rejections per session means better
        alignment over time.
      </p>
      {tasteStats ? (
        <div className="stats-grid mt-6">
          <div className="benchmark-row">
            <strong>{tasteStats.active_rules}</strong>
            <div className="small">Active rules</div>
          </div>
          <div className="benchmark-row">
            <strong>{tasteStats.rejections}</strong>
            <div className="small">Rejections</div>
          </div>
          <div className="benchmark-row">
            <strong>{tasteStats.approvals}</strong>
            <div className="small">Approvals</div>
          </div>
          <div className="benchmark-row">
            <strong>{tasteStats.avg_rejections_per_session}</strong>
            <div className="small">Avg rejections / session</div>
          </div>
        </div>
      ) : (
        <EmptyState title="Taste stats unavailable" description="Approve or reject proposals to build your profile." />
      )}
      <div className="mt-8">
        <button type="button" onClick={handleExportTaste} disabled={loading}>
          Export taste pack
        </button>
      </div>
      <div className="session-list mt-8">
        {tasteRules.length === 0 ? (
          <EmptyState
            title="No taste rules yet"
            description="Reject or approve code proposals with notes to teach CodeForge your preferences."
          />
        ) : (
          tasteRules.map((rule) => (
            <div className="benchmark-row" key={rule.rule_id}>
              <strong>Weight {rule.weight}</strong>
              <div className="small">{rule.rule_text}</div>
            </div>
          ))
        )}
      </div>
      {tasteMd ? (
        <details className="mt-8">
          <summary className="small">View taste.md preview</summary>
          <pre className="small mt-4">{tasteMd}</pre>
        </details>
      ) : null}
      <form onSubmit={handleImportTaste} className="mt-8">
        <label className="small" htmlFor="taste-import">
          Import taste pack (JSON)
        </label>
        <textarea
          id="taste-import"
          rows={6}
          value={tasteImportJson}
          placeholder='{"version":1,"rules":[{"rule_text":"Prefer Vitest","weight":3}]}'
          onChange={(event) => setTasteImportJson(event.target.value)}
          disabled={loading}
        />
        <div className="mt-6">
          <button type="submit" disabled={loading || !tasteImportJson.trim()}>
            Import taste pack
          </button>
        </div>
      </form>
    </section>
  );

  const mcpTab = !token ? (
    <EmptyState title="Sign in required" description="MCP connectors require an authenticated session." />
  ) : (
    <section className="panel">
      <h2>MCP Connectors</h2>
      <p className="small">
        Browse the <a href="/extensions">Extensions catalog</a> (LSP, plugins, hooks) or <a href="/mcp">MCP servers</a> to one-click install standard integrations.
      </p>
      <form onSubmit={handleCreateConnector}>
        <label className="small" htmlFor="connector-name">
          Name
        </label>
        <input
          id="connector-name"
          value={connectorName}
          onChange={(event) => setConnectorName(event.target.value)}
          disabled={loading}
        />
        <label className="small" htmlFor="connector-endpoint">
          Endpoint
        </label>
        <input
          id="connector-endpoint"
          value={connectorEndpoint}
          placeholder="https://example.com/mcp"
          onChange={(event) => setConnectorEndpoint(event.target.value)}
          disabled={loading}
        />
        <label className="small" htmlFor="connector-transport">
          Transport
        </label>
        <select
          id="connector-transport"
          value={connectorTransport}
          onChange={(event) => setConnectorTransport(event.target.value)}
          disabled={loading}
        >
          <option value="http">http</option>
          <option value="websocket">websocket</option>
          <option value="stdio">stdio</option>
        </select>
        <label className="small" htmlFor="connector-tools">
          Tools (comma separated)
        </label>
        <input
          id="connector-tools"
          value={connectorTools}
          placeholder="search, fetch"
          onChange={(event) => setConnectorTools(event.target.value)}
          disabled={loading}
        />
        <div className="mt-6">
          <button type="submit" disabled={loading || !connectorName.trim() || !connectorEndpoint.trim()}>
            Create Connector
          </button>
        </div>
      </form>
      <div className="session-list mt-8">
        {connectors.length === 0 ? <EmptyState title="No MCP connectors" description="Add a connector to extend tools." /> : null}
        {connectors.map((connector) => (
          <div className="benchmark-row" key={connector.connector_id}>
            <strong>{connector.name}</strong>
            <div className="small">
              {connector.transport} | {connector.endpoint}
            </div>
            <div className="small">
              tools: {connector.tools.join(", ") || "none"} | {connector.enabled ? "enabled" : "disabled"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="stack">
      <section className="panel">
        <h2>Settings</h2>
        <p className="small">
          Profile, project defaults, token saver, memory, coding taste, context packs, MCP connectors, and deploy readiness.
        </p>
      </section>
      <Tabs
        defaultTab="profile"
        tabs={[
          { id: "profile", label: "Profile", content: profileTab },
          { id: "project", label: "Project", content: projectTab },
          { id: "token-saver", label: "Token Saver", content: tokenSaverTab },
          { id: "memory", label: "Memory", content: memoryTab },
          { id: "taste", label: "Taste", content: tasteTab },
          { id: "context", label: "Context", content: contextTab },
          { id: "mcp", label: "MCP", content: mcpTab },
          { id: "auth", label: "SSO", content: authTab },
          { id: "deploy", label: "Deploy", content: deployTab },
        ]}
      />
    </div>
  );
}
