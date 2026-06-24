"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import CatalogItemActions from "../../components/CatalogItemActions";
import { useAuth } from "../../lib/auth-context";
import {
  disableMcpCatalogServer,
  installAllMcpCatalog,
  installMcpCatalogCategory,
  installMcpCatalogServer,
  listMcpCatalog,
  updateMcpCatalogServer,
} from "../../lib/api";

const INTEGRATION_LABELS = {
  native: "Built-in",
  stdio: "Local (stdio)",
  http: "Remote (HTTP)",
};

function integrationBadge(integration) {
  const label = INTEGRATION_LABELS[integration] || integration;
  return <span className={`mcp-badge mcp-badge-${integration}`}>{label}</span>;
}

export default function McpPage() {
  const { token, ready } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!token) {
      setCatalog(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listMcpCatalog(token);
      setCatalog(data);
    } catch (error) {
      setMessage(error.message || "Failed to load MCP catalog");
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    refresh();
  }, [ready, refresh]);

  async function handleEnable(serverId) {
    if (!token) return;
    setBusyId(serverId);
    setMessage("");
    try {
      const result = await installMcpCatalogServer(token, serverId);
      setMessage(
        result.created > 0 ? `Enabled ${serverId}` : `${serverId} was already enabled`,
      );
      await refresh();
    } catch (error) {
      setMessage(error.message || "Enable failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisable(serverId) {
    if (!token) return;
    setBusyId(serverId);
    setMessage("");
    try {
      await disableMcpCatalogServer(token, serverId);
      setMessage(`Disabled ${serverId}`);
      await refresh();
    } catch (error) {
      setMessage(error.message || "Disable failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(serverId) {
    if (!token) return;
    setBusyId(serverId);
    setMessage("");
    try {
      const result = await updateMcpCatalogServer(token, serverId);
      setMessage(result.updated ? `Updated ${serverId}` : `${serverId} is already up to date`);
      await refresh();
    } catch (error) {
      setMessage(error.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleInstallCategory(categoryId) {
    if (!token) return;
    setBusyId(`cat:${categoryId}`);
    setMessage("");
    try {
      const result = await installMcpCatalogCategory(token, categoryId);
      setMessage(`Added ${result.created} connector(s) from category`);
      await refresh();
    } catch (error) {
      setMessage(error.message || "Category install failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleInstallAll() {
    if (!token) return;
    setBusyId("all");
    setMessage("");
    try {
      const result = await installAllMcpCatalog(token);
      setMessage(`Installed ${result.created} new connector(s) — ${result.total} total in catalog`);
      await refresh();
    } catch (error) {
      setMessage(error.message || "Bulk install failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) {
    return <p className="small">Loading…</p>;
  }

  if (!token) {
    return (
      <section className="panel">
        <h2>MCP Servers</h2>
        <p className="small">Sign in to browse and enable MCP connectors.</p>
        <Link href="/login?next=/mcp">Sign in</Link>
      </section>
    );
  }

  const categories = catalog?.categories || [];
  const servers = catalog?.servers || [];
  const agentReachServer = servers.find((server) => server.id === "agent_reach");
  const agentReachEnabled = Boolean(agentReachServer?.enabled || agentReachServer?.installed);

  return (
    <div className="mcp-page agents-page">
      <header className="features-hero cf-animate-in">
        <p className="features-hero-kicker">
          <span className="cf-sparkle-inline" aria-hidden>🌐</span>
          Model Context Protocol
        </p>
        <h1>MCP server catalog</h1>
        <p className="features-hero-sub">
          Enable, disable, or update standard MCP integrations — engineering tools, databases, web search, workspace apps, and more.
          Native servers work immediately; stdio/HTTP servers need API keys or a local process.
        </p>
        <div className="mcp-hero-actions">
          <button
            type="button"
            className="cf-hover-lift"
            onClick={handleInstallAll}
            disabled={busyId === "all" || loading}
          >
            {busyId === "all" ? "Enabling…" : "Enable full suite"}
          </button>
          <Link href="/extensions" className="features-hero-link cf-hover-lift">
            Extensions →
          </Link>
          <Link href="/settings" className="features-hero-link cf-hover-lift">
            Manage connectors →
          </Link>
        </div>
        {catalog ? (
          <p className="small mcp-stats">
            {catalog.total} servers · {catalog.enabled_count ?? catalog.installed_count} enabled · catalog {catalog.catalog_revision || "—"}
          </p>
        ) : null}
        {message ? <p className="small mcp-flash">{message}</p> : null}
      </header>

      {agentReachServer ? (
        <section className="panel mcp-featured-card cf-animate-in">
          <h2>Agent Reach (recommended)</h2>
          <p className="small">
            Server-safe internet research: web, YouTube, RSS, GitHub, Exa, Bilibili, and Firecrawl.
            Pair with the <Link href="/settings">agent-reach skill</Link> for Twitter/Reddit/XHS on your local machine.
          </p>
          <div className="mcp-hero-actions">
            <CatalogItemActions
              itemId="agent_reach"
              enabled={agentReachEnabled}
              updateAvailable={Boolean(agentReachServer?.update_available)}
              busyId={busyId}
              onEnable={handleEnable}
              onDisable={handleDisable}
              onUpdate={handleUpdate}
            />
          </div>
          <p className="small muted">
            Full setup: enable the agent-reach skill in Settings and see <code>docs/AGENT_REACH.md</code> in the repo.
          </p>
        </section>
      ) : null}

      {loading ? <p className="small">Loading catalog…</p> : null}

      {categories.map((category, catIndex) => {
        const items = servers.filter((server) => server.category === category.id);
        if (items.length === 0) return null;
        return (
          <section
            key={category.id}
            className="feature-category cf-animate-in"
            style={{ animationDelay: `${catIndex * 80}ms` }}
          >
            <header className="feature-category-header">
              <span className="feature-category-emoji cf-bounce-gentle" aria-hidden>
                {category.emoji}
              </span>
              <div>
                <h2>{category.title}</h2>
                <button
                  type="button"
                  className="ghost-btn small mcp-cat-install"
                  onClick={() => handleInstallCategory(category.id)}
                  disabled={busyId === `cat:${category.id}`}
                >
                  {busyId === `cat:${category.id}` ? "Adding…" : `Enable all ${items.length}`}
                </button>
              </div>
            </header>

            <div className="feature-card-grid">
              {items.map((server, index) => (
                <article
                  key={server.id}
                  className={`feature-card mcp-card cf-animate-in cf-hover-lift ${server.enabled || server.installed ? "mcp-card-installed" : ""}`}
                  style={{ animationDelay: `${catIndex * 80 + index * 40}ms` }}
                >
                  <div className="feature-card-glow" aria-hidden />
                  <div className="mcp-card-meta">
                    {integrationBadge(server.integration)}
                    {server.enabled || server.installed ? <span className="mcp-badge mcp-badge-on">Enabled</span> : null}
                    {server.update_available ? <span className="mcp-badge mcp-badge-http">Update available</span> : null}
                  </div>
                  <h3>{server.name}</h3>
                  <p className="small feature-card-desc">{server.description}</p>
                  <p className="small mcp-tools">
                    Tools: {server.tools.slice(0, 4).join(", ")}
                    {server.tools.length > 4 ? "…" : ""}
                  </p>
                  {server.env_vars?.length > 0 ? (
                    <p className="small mcp-env">
                      Keys: {server.env_vars.join(", ")}
                    </p>
                  ) : null}
                  {server.setup_note ? (
                    <p className="small mcp-setup">{server.setup_note}</p>
                  ) : null}
                  {server.installed_version ? (
                    <p className="small mcp-env">Version: {server.installed_version}</p>
                  ) : null}
                  <div className="mcp-card-actions">
                    <CatalogItemActions
                      itemId={server.id}
                      enabled={server.enabled || server.installed}
                      updateAvailable={server.update_available}
                      busyId={busyId}
                      onEnable={handleEnable}
                      onDisable={handleDisable}
                      onUpdate={handleUpdate}
                      enableLabel="Enable"
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section className="panel mcp-discovery cf-animate-in">
        <h2>Discover more servers</h2>
        <p className="small">
          The MCP ecosystem has thousands of community packages. Run the discovery tool locally:
        </p>
        <code className="mcp-code">npx -y a2asearch-mcp</code>
        <p className="small">
          Or browse the{" "}
          <a href="https://registry.modelcontextprotocol.io/" target="_blank" rel="noreferrer">
            Official MCP Registry
          </a>
          .
        </p>
      </section>
    </div>
  );
}
