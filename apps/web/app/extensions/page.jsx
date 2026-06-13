"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import CatalogItemActions from "../../components/CatalogItemActions";
import { useAuth } from "../../lib/auth-context";
import {
  disableExtension,
  installAllLspExtensions,
  installExtension,
  listExtensionsCatalog,
  updateExtension,
} from "../../lib/api";

const KIND_LABELS = {
  lsp: "LSP",
  workflow: "Plugin",
  native: "Native",
};

function kindBadge(kind) {
  return (
    <span className={`mcp-badge mcp-badge-${kind === "native" ? "stdio" : kind === "lsp" ? "native" : "http"}`}>
      {KIND_LABELS[kind] || kind}
    </span>
  );
}

export default function ExtensionsPage() {
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
      const data = await listExtensionsCatalog(token);
      setCatalog(data);
    } catch (error) {
      setMessage(error.message || "Failed to load extensions");
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    refresh();
  }, [ready, refresh]);

  async function handleEnable(extensionId) {
    if (!token) return;
    setBusyId(extensionId);
    setMessage("");
    try {
      const result = await installExtension(token, extensionId);
      setMessage(
        result.created ? `Enabled ${extensionId}` : `${extensionId} was already enabled`,
      );
      await refresh();
    } catch (error) {
      setMessage(error.message || "Enable failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisable(extensionId) {
    if (!token) return;
    setBusyId(extensionId);
    setMessage("");
    try {
      await disableExtension(token, extensionId);
      setMessage(`Disabled ${extensionId}`);
      await refresh();
    } catch (error) {
      setMessage(error.message || "Disable failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(extensionId) {
    if (!token) return;
    setBusyId(extensionId);
    setMessage("");
    try {
      const result = await updateExtension(token, extensionId);
      setMessage(result.updated ? `Updated ${extensionId}` : `${extensionId} is already up to date`);
      await refresh();
    } catch (error) {
      setMessage(error.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleInstallAllLsp() {
    if (!token) return;
    setBusyId("lsp-all");
    try {
      const result = await installAllLspExtensions(token);
      setMessage(`Enabled ${result.installed} LSP plugin(s)`);
      await refresh();
    } catch (error) {
      setMessage(error.message || "LSP install failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <p className="small">Loading…</p>;

  if (!token) {
    return (
      <section className="panel">
        <h2>Extensions</h2>
        <p className="small">Sign in to browse Claude Code–style extensions.</p>
        <Link href="/login?next=/extensions">Sign in</Link>
      </section>
    );
  }

  const categories = catalog?.categories || [];
  const extensions = catalog?.extensions || [];

  return (
    <div className="extensions-page agents-page">
      <header className="features-hero cf-animate-in">
        <p className="features-hero-kicker">
          <span className="cf-sparkle-inline" aria-hidden>🔌</span>
          Extension surface
        </p>
        <h1>Extensions — LSP &amp; plugins</h1>
        <p className="features-hero-sub">
          LSP code intelligence, workflow plugins, and native rules/skills/hooks. Enable, disable, or update each item from the catalog.
        </p>
        <div className="mcp-hero-actions">
          <button type="button" className="cf-hover-lift" onClick={handleInstallAllLsp} disabled={busyId === "lsp-all" || loading}>
            {busyId === "lsp-all" ? "Enabling…" : "Enable all LSP plugins"}
          </button>
          <Link href="/mcp" className="features-hero-link cf-hover-lift">
            MCP servers →
          </Link>
          <Link href="/settings" className="features-hero-link cf-hover-lift">
            Settings →
          </Link>
        </div>
        {catalog ? (
          <p className="small mcp-stats">
            {catalog.total} extensions · {catalog.enabled_count} enabled · catalog {catalog.catalog_revision || "—"}
          </p>
        ) : null}
        {message ? <p className="small mcp-flash">{message}</p> : null}
      </header>

      {loading ? <p className="small">Loading extensions…</p> : null}

      {categories.map((category, catIndex) => {
        const items = extensions.filter((ext) => ext.category === category.id);
        if (items.length === 0) return null;
        return (
          <section key={category.id} className="feature-category cf-animate-in" style={{ animationDelay: `${catIndex * 80}ms` }}>
            <header className="feature-category-header">
              <span className="feature-category-emoji cf-bounce-gentle" aria-hidden>{category.emoji}</span>
              <div>
                <h2>{category.title}</h2>
                {category.id === "lsp" ? (
                  <p className="small">Requires language-server binaries on the host. Symbol search fallback when unavailable.</p>
                ) : null}
                {category.id === "native" ? (
                  <p className="small">Hook events: {catalog?.hook_events?.join(", ")}</p>
                ) : null}
              </div>
            </header>

            <div className="feature-card-grid">
              {items.map((ext, index) => (
                <article
                  key={ext.id}
                  className={`feature-card mcp-card cf-animate-in cf-hover-lift ${ext.enabled ? "mcp-card-installed" : ""}`}
                  style={{ animationDelay: `${catIndex * 80 + index * 40}ms` }}
                >
                  <div className="feature-card-glow" aria-hidden />
                  <div className="mcp-card-meta">
                    {kindBadge(ext.kind)}
                    {ext.enabled ? <span className="mcp-badge mcp-badge-on">Enabled</span> : null}
                    {ext.update_available ? <span className="mcp-badge mcp-badge-http">Update available</span> : null}
                    {ext.binary_installed === true ? <span className="mcp-badge mcp-badge-native">Binary OK</span> : null}
                    {ext.binary_installed === false && ext.kind === "lsp" ? (
                      <span className="mcp-badge mcp-badge-http">Binary missing</span>
                    ) : null}
                  </div>
                  <h3>{ext.name}</h3>
                  <p className="small feature-card-desc">{ext.description}</p>
                  {ext.language ? <p className="small mcp-tools">Language: {ext.language}</p> : null}
                  {ext.binary ? <p className="small mcp-env">Binary: {ext.binary}</p> : null}
                  {ext.install_hint ? <p className="small mcp-setup">{ext.install_hint}</p> : null}
                  {ext.config_path ? <p className="small mcp-setup">Path: {ext.config_path}</p> : null}
                  {ext.setup_note ? <p className="small mcp-setup">{ext.setup_note}</p> : null}
                  {ext.skills?.length > 0 ? <p className="small mcp-tools">Skills: {ext.skills.join(", ")}</p> : null}
                  {ext.enabled && ext.installed_version ? (
                    <p className="small mcp-env">Version: {ext.installed_version}</p>
                  ) : null}
                  <div className="mcp-card-actions">
                    <CatalogItemActions
                      itemId={ext.id}
                      enabled={ext.enabled}
                      updateAvailable={ext.update_available}
                      busyId={busyId}
                      onEnable={handleEnable}
                      onDisable={handleDisable}
                      onUpdate={handleUpdate}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section className="panel mcp-discovery cf-animate-in">
        <h2>Discover more</h2>
        <p className="small">
          Claude Code opens the plugin manager with <code className="mcp-code inline-code">/plugin</code>. MCP servers live on their own page.
        </p>
        <Link href="/mcp" className="features-hero-link">Browse MCP servers →</Link>
      </section>
    </div>
  );
}
