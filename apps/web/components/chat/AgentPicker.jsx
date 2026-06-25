"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@codeforge/ui";

import { AGENT_CATEGORIES, DEFAULT_AGENT_TYPE } from "../../lib/agent-catalog";

const CATEGORY_TITLES = Object.fromEntries(AGENT_CATEGORIES.map((c) => [c.id, c.title]));

export default function AgentPicker({ agents, selectedAgent, onSelectAgent, loading, compact = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const current = agents.find((agent) => agent.id === selectedAgent) || null;
  const activeId = selectedAgent || DEFAULT_AGENT_TYPE;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = agents.length > 0 ? agents : [{ id: DEFAULT_AGENT_TYPE, name: "Conversational Agent", tagline: "Default chat agent" }];
    if (!needle) {
      return list;
    }
    return list.filter(
      (agent) =>
        agent.name?.toLowerCase().includes(needle) ||
        agent.id?.toLowerCase().includes(needle) ||
        agent.tagline?.toLowerCase().includes(needle) ||
        CATEGORY_TITLES[agent.category]?.toLowerCase().includes(needle),
    );
  }, [agents, query]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const agent of filtered) {
      const key = agent.category || "operational";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(agent);
    }
    return groups;
  }, [filtered]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }
    return undefined;
  }, [open]);

  function selectAgent(id) {
    onSelectAgent(id);
    setOpen(false);
    setQuery("");
  }

  const displayName = current?.name || "Conversational Agent";

  return (
    <div className="cf-agent-combobox" ref={rootRef}>
      <button
        type="button"
        className="cf-agent-trigger"
        onClick={() => setOpen((value) => !value)}
        disabled={loading}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={current?.tagline || "Select agent pattern"}
      >
        <Icon name="Bot" size={16} />
        <span className="cf-agent-trigger-label">
          {displayName}
          {!compact && current?.tagline ? (
            <span className="cf-agent-trigger-meta">{current.tagline}</span>
          ) : null}
        </span>
        <Icon name="ChevronDown" size={14} />
      </button>

      {open ? (
        <div className="cf-agent-menu" role="listbox" aria-label="Agent patterns">
          <div className="cf-agent-menu-search cf-search-field">
            <Icon name="Search" size={14} />
            <input
              type="search"
              placeholder="Search agents…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>
          <div className="cf-agent-menu-list">
            {filtered.length === 0 ? (
              <p className="cf-agent-menu-empty">No agents match your search.</p>
            ) : (
              [...grouped.entries()].map(([categoryId, items]) => (
                <div key={categoryId}>
                  <p className="cf-agent-menu-group-label">{CATEGORY_TITLES[categoryId] || categoryId}</p>
                  {items.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      role="option"
                      aria-selected={agent.id === activeId}
                      className={`cf-agent-menu-item ${agent.id === activeId ? "is-selected" : ""}`}
                      onClick={() => selectAgent(agent.id)}
                    >
                      <span className="cf-agent-menu-item-name">{agent.name}</span>
                      {agent.tagline ? <span className="cf-agent-menu-item-tagline">{agent.tagline}</span> : null}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <Link href="/agents" className="cf-agent-browse">
        Browse all patterns
      </Link>
    </div>
  );
}
