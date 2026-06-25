"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal, buildRevealClassName, useScrollReveal } from "./useScrollReveal";

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h10M4 18h6" />
      <circle cx="18" cy="12" r="3" />
      <circle cx="14" cy="18" r="3" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

function RupeeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12M6 8h12M6 13c0 3 2 5 6 5h4" />
    </svg>
  );
}

const TILES = [
  {
    id: "chat",
    large: true,
    icon: ChatIcon,
    title: "AI product partner",
    description: "Describe your app idea in plain language. Get PRDs, plans, and working code without prior experience.",
    snippet: '> "Build a marketplace for local artisans"\n→ PRD · plan · code · deploy',
  },
  {
    id: "agents",
    icon: AgentIcon,
    title: "30+ agent patterns",
    description: "Security review, bug fixes, refactors — specialized agents for every stage.",
    chips: ["Security", "PRD", "Debug", "Refactor"],
  },
  {
    id: "mcp",
    icon: GlobeIcon,
    title: "MCP & Agent Reach",
    description: "Web research, YouTube transcripts, RSS, GitHub — built-in internet research.",
    snippet: "fetch_web · youtube · rss_read",
  },
  {
    id: "cowork",
    icon: WorkflowIcon,
    title: "Cowork automations",
    description: "File workflows, scheduled tasks, and browser automation.",
    snippet: "schedule → scrape → notify",
  },
  {
    id: "code",
    icon: CodeIcon,
    title: "Full code editor",
    description: "Monaco IDE with git, terminal, and LSP extensions.",
    snippet: "git status · terminal · LSP",
  },
  {
    id: "pricing",
    icon: RupeeIcon,
    title: "India-first pricing",
    description: "Affordable INR plans via Razorpay. Start free, scale when ready.",
    snippet: "₹ Free · Pro · Team",
  },
];

function BentoTile({ tile, index }) {
  const { ref, animate, visible } = useScrollReveal();
  const Icon = tile.icon;
  const delayClass = `landing-reveal-delay-${Math.min(index + 1, 5)}`;

  return (
    <div
      ref={ref}
      className={`landing-bento-tile landing-glass landing-glow-border ${buildRevealClassName({ animate, visible, extra: delayClass })} ${tile.large ? "landing-bento-tile--large" : ""}`.trim()}
    >
      <div className="landing-bento-icon">
        <Icon />
      </div>
      <h3>{tile.title}</h3>
      <p>{tile.description}</p>
      {tile.snippet ? <div className="landing-bento-snippet">{tile.snippet}</div> : null}
      {tile.chips ? (
        <div className="landing-bento-chips">
          {tile.chips.map((chip) => (
            <span key={chip} className="landing-bento-chip">
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function LandingFeatures() {
  return (
    <section id="capabilities" className="landing-features landing-section-block mkt-section">
      <LandingContainer>
        <ScrollReveal className="landing-section-header mkt-section-header">
          <span className="landing-section-eyebrow mkt-eyebrow">Platform</span>
          <h2>Everything in one agentic workspace</h2>
          <p>IDE, composer, MCP research, and verify loops — the stack Cursor and Linear users expect, tuned for India.</p>
        </ScrollReveal>

        <div className="landing-bento">
          {TILES.map((tile, index) => (
            <BentoTile key={tile.id} tile={tile} index={index} />
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
