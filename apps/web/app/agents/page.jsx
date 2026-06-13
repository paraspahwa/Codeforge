"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { listAgents } from "../../lib/api";
import { AGENT_CATEGORIES, COMPLEXITY_LABELS, queueAgentSelection } from "../../lib/agent-catalog";
import { queueChatGoal } from "../../lib/product-features";

function complexityClass(complexity) {
  return `agent-complexity agent-complexity-${complexity || "medium"}`;
}

export default function AgentsPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState({ agents: [], categories: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    listAgents()
      .then((data) =>
        setCatalog({
          agents: data.agents || [],
          categories: data.categories || [],
          total: data.total || (data.agents || []).length,
        }),
      )
      .catch(() => setCatalog({ agents: [], categories: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const categories = catalog.categories.length > 0 ? catalog.categories : AGENT_CATEGORIES;

  const visibleAgents = useMemo(() => {
    if (activeCategory === "all") {
      return catalog.agents;
    }
    return catalog.agents.filter((agent) => agent.category === activeCategory);
  }, [catalog.agents, activeCategory]);

  function startWithAgent(agent) {
    queueAgentSelection(agent.id);
    queueChatGoal({ prompt: agent.starter_prompt, planMode: agent.id === "hitl" || agent.id === "planning" });
    router.push("/");
  }

  return (
    <div className="agents-page">
      <header className="features-hero cf-animate-in">
        <p className="features-hero-kicker">
          <span className="cf-sparkle-inline" aria-hidden>🤖</span>
          Agentic design patterns
        </p>
        <h1>{catalog.total || "30+"} AI agents — full agentic universe</h1>
        <p className="features-hero-sub">
          Foundational logic, ReAct &amp; reflection, multi-agent orchestration, human-in-the-loop, industry roles,
          infrastructure, and lifecycle patterns — like Claude Code, AutoGen, and CrewAI.
        </p>
        <Link href="/features" className="features-hero-link cf-hover-lift">
          ← All features
        </Link>
      </header>

      <nav className="agent-category-nav cf-animate-in" aria-label="Filter by category">
        <button
          type="button"
          className={activeCategory === "all" ? "agent-cat-pill agent-cat-pill-active" : "agent-cat-pill"}
          onClick={() => setActiveCategory("all")}
        >
          All ({catalog.total})
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={activeCategory === category.id ? "agent-cat-pill agent-cat-pill-active" : "agent-cat-pill"}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.emoji} {category.title}
          </button>
        ))}
      </nav>

      {loading ? <p className="small">Loading agents…</p> : null}

      {activeCategory === "all"
        ? categories.map((category, catIndex) => {
            const items = catalog.agents.filter((agent) => agent.category === category.id);
            if (items.length === 0) return null;
            return (
              <section
                key={category.id}
                className="feature-category cf-animate-in"
                style={{ animationDelay: `${catIndex * 60}ms` }}
              >
                <header className="feature-category-header">
                  <span className="feature-category-emoji cf-bounce-gentle" aria-hidden>
                    {category.emoji}
                  </span>
                  <div>
                    <h2>{category.title}</h2>
                    <p className="small">{category.subtitle}</p>
                  </div>
                </header>
                <AgentCardGrid agents={items} onStart={startWithAgent} baseDelay={catIndex * 60} />
              </section>
            );
          })
        : (
          <section className="feature-category cf-animate-in">
            <AgentCardGrid agents={visibleAgents} onStart={startWithAgent} />
          </section>
        )}
    </div>
  );
}

function AgentCardGrid({ agents, onStart, baseDelay = 0 }) {
  return (
    <div className="feature-card-grid">
      {agents.map((agent, index) => (
        <article
          key={agent.id}
          className="feature-card agent-card cf-animate-in cf-hover-lift"
          style={{ animationDelay: `${baseDelay + index * 40}ms` }}
        >
          <div className="feature-card-glow" aria-hidden />
          <div className="agent-card-meta">
            <span className={complexityClass(agent.complexity)} title={COMPLEXITY_LABELS[agent.complexity]}>
              {agent.complexity || "medium"}
            </span>
          </div>
          <span className="feature-card-icon cf-wiggle-hover" aria-hidden>
            {agent.icon}
          </span>
          <h3>{agent.name}</h3>
          <p className="agent-card-tagline small">{agent.tagline}</p>
          <p className="small feature-card-desc">{agent.description}</p>
          <p className="small agent-card-example">
            <em>Example:</em> {agent.example}
          </p>
          <div className="feature-card-actions">
            <button
              type="button"
              className="feature-card-btn feature-card-btn-primary"
              onClick={() => onStart(agent)}
            >
              <span className="feature-card-btn-spark" aria-hidden>✦</span>
              Use this agent
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
