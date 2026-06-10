"use client";

import { useEffect, useState } from "react";
import { EmptyState, Skeleton, Tabs } from "@codeforge/ui";

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

  const mcpTab = !token ? (
    <EmptyState title="Sign in required" description="MCP connectors require an authenticated session." />
  ) : (
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
        <p className="small">Profile, project defaults, context packs, MCP connectors, and deploy readiness.</p>
      </section>
      <Tabs
        defaultTab="profile"
        tabs={[
          { id: "profile", label: "Profile", content: profileTab },
          { id: "project", label: "Project", content: projectTab },
          { id: "context", label: "Context", content: contextTab },
          { id: "mcp", label: "MCP", content: mcpTab },
          { id: "deploy", label: "Deploy", content: deployTab },
        ]}
      />
    </div>
  );
}
