"use client";

import { useEffect, useState } from "react";

import {
  createContextPack,
  createMcpConnector,
  getDeployReadiness,
  listContextPacks,
  listMcpConnectors,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

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
    getDeployReadiness(false)
      .then(setDeployReadiness)
      .catch(() => setDeployReadiness(null));
  }, [ready, token]);

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

  return (
    <div className="stack">
      <section className="panel">
        <h2>Profile</h2>
        <p className="small">User: {userId || "not logged in"}</p>
        <p className="small">API base: {API_BASE}</p>

        <hr className="divider" />

        <h3>Default Project Path</h3>
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
          <p className="small">Deploy readiness unavailable.</p>
        )}
      </section>

      {ready && !token ? (
        <section className="panel empty-state">
          <p className="small">Login from the top bar to manage context packs and MCP connectors.</p>
        </section>
      ) : (
        <div className="two-col">
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
              {packs.length === 0 ? <p className="small">No context packs yet.</p> : null}
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

          <section className="panel">
            <h2>MCP Connectors</h2>
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
              {connectors.length === 0 ? <p className="small">No MCP connectors yet.</p> : null}
              {connectors.map((connector) => (
                <div className="benchmark-row" key={connector.connector_id}>
                  <strong>{connector.name}</strong>
                  <div className="small">
                    {connector.transport} | {connector.endpoint}
                  </div>
                  <div className="small">
                    tools: {connector.tools.join(", ") || "none"} |{" "}
                    {connector.enabled ? "enabled" : "disabled"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
