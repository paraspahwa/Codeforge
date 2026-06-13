"""Catalog of CodeForge agent architectures, design patterns, and deployment roles."""

from __future__ import annotations

from typing import Any, Literal

AgentCategory = Literal[
    "foundational",
    "design_pattern",
    "multi_agent",
    "human_integration",
    "industry",
    "infrastructure",
    "lifecycle",
    "operational",
]

AgentArchitecture = Literal[
    "simple_reflex",
    "model_reflex",
    "goal_based",
    "utility_based",
    "learning",
    "react",
    "reflection",
    "planning",
    "orchestrator_worker",
    "sequential_chain",
    "parallel_fanout",
    "swarm_p2p",
    "hitl",
    "critic_generator",
    "revenue_sdr",
    "support_resolution",
    "software_engineer_cloud",
    "secops_pentest",
    "idp_document",
    "compliance_regulatory",
    "edge_local",
    "cloud_sandbox",
    "browser_rpa",
    "ephemeral",
    "persistent_memory",
    "conversational",
    "task_orchestration",
    "coding_devops",
    "hierarchical",
    "multi_agent_swarm",
    "hermes",
]

DEFAULT_AGENT_TYPE: AgentArchitecture = "conversational"

AGENT_CATEGORY_META: list[dict[str, str]] = [
    {
        "id": "foundational",
        "title": "Foundational logic",
        "subtitle": "Classic agent classes — reflex, goals, utility, learning",
        "emoji": "🧠",
    },
    {
        "id": "design_pattern",
        "title": "Single-agent patterns",
        "subtitle": "ReAct, reflection, and planning workflows",
        "emoji": "🔄",
    },
    {
        "id": "multi_agent",
        "title": "Multi-agent orchestration",
        "subtitle": "Supervisor, pipelines, parallel fan-out, peer swarms",
        "emoji": "👥",
    },
    {
        "id": "human_integration",
        "title": "Human-agent integration",
        "subtitle": "Approvals, debate, and human-in-the-loop guardrails",
        "emoji": "🤝",
    },
    {
        "id": "industry",
        "title": "Industry & enterprise",
        "subtitle": "Revenue, support, engineering, security, compliance",
        "emoji": "🏬",
    },
    {
        "id": "infrastructure",
        "title": "Infrastructure & execution",
        "subtitle": "Edge, cloud sandbox, and browser/RPA agents",
        "emoji": "⚙️",
    },
    {
        "id": "lifecycle",
        "title": "Memory & lifecycle",
        "subtitle": "Ephemeral task agents vs long-term memory agents",
        "emoji": "🕐",
    },
    {
        "id": "operational",
        "title": "CodeForge operations",
        "subtitle": "Chat, tools, coding, Hermes sidecar",
        "emoji": "🛠️",
    },
]

AGENT_DEFINITIONS: list[dict[str, Any]] = [
    # ── Foundational logic (classic AI agent classes) ──
    {
        "id": "simple_reflex",
        "name": "Simple Reflex Agent",
        "category": "foundational",
        "complexity": "low",
        "icon": "⚡",
        "tagline": "Instant If-Then reactions",
        "description": "Purely reactive — applies rigid rules to the current input with no memory or planning.",
        "example": "Spam filter, thermostat-style triggers",
        "starter_prompt": "Run in reflex mode: classify my request and give one immediate action based on current input only.",
    },
    {
        "id": "model_reflex",
        "name": "Model-Based Reflex Agent",
        "category": "foundational",
        "complexity": "low",
        "icon": "🧭",
        "tagline": "Reactive + world model",
        "description": "Tracks session state and recent context so reactions account for what happened before.",
        "example": "Roomba-style navigation with memory of what's done",
        "starter_prompt": "Use your session memory: summarize what we've done so far, then react to my latest request.",
    },
    {
        "id": "goal_based",
        "name": "Goal-Based Agent",
        "category": "foundational",
        "complexity": "medium",
        "icon": "🎯",
        "tagline": "Plan steps to a goal",
        "description": "Takes a final objective and produces a multi-step action plan before executing.",
        "example": "GPS navigation — destination in, route out",
        "starter_prompt": "My goal: build an MVP for my app idea. Break it into ordered steps and tell me the plan before acting.",
    },
    {
        "id": "utility_based",
        "name": "Utility-Based Agent",
        "category": "foundational",
        "complexity": "medium",
        "icon": "⚖️",
        "tagline": "Optimize trade-offs",
        "description": "Scores options on speed, cost, safety, and quality to pick the best path.",
        "example": "Trading bots, route optimizers",
        "starter_prompt": "Compare 3 approaches to my task. Score each on speed, cost, and risk, then recommend the best option.",
    },
    {
        "id": "learning",
        "name": "Learning Agent",
        "category": "foundational",
        "complexity": "medium",
        "icon": "📈",
        "tagline": "Improves from feedback",
        "description": "Uses taste rules and memory from past sessions to adapt responses over time.",
        "example": "Recommendation engines that refine with use",
        "starter_prompt": "Learn from our past chats and my preferences. Apply what you know about me to help with this request.",
    },
    # ── Single-agent design patterns ──
    {
        "id": "react",
        "name": "ReAct Agent",
        "category": "design_pattern",
        "complexity": "low",
        "icon": "🔁",
        "tagline": "Reason + Act loop",
        "description": "Alternates Thought → Action → Observation until the goal is met. Like Claude Code adapting to shell errors.",
        "example": "Bash commands, API calls, tool use with live feedback",
        "starter_prompt": "Use ReAct: for each step write Thought, Action, and Observation until my task is complete.",
    },
    {
        "id": "reflection",
        "name": "Reflection Agent",
        "category": "design_pattern",
        "complexity": "medium",
        "icon": "🪞",
        "tagline": "Self-correct before output",
        "description": "Drafts output, critiques it against strict rules, rewrites, then delivers the final version.",
        "example": "Secure code generation, compliance drafting, data validation",
        "starter_prompt": "Draft a solution, critique it for flaws, rewrite it, then show only the improved final output.",
    },
    {
        "id": "planning",
        "name": "Planning Agent",
        "category": "design_pattern",
        "complexity": "medium",
        "icon": "🗺️",
        "tagline": "Strategy then execution",
        "description": "Builds a full A→Z roadmap first, executes step-by-step, and replans if a step fails.",
        "example": "Monolith migrations, multi-chapter technical docs",
        "starter_prompt": "Create a complete execution roadmap for my goal, then execute step 1 and note replan triggers.",
    },
    # ── Multi-agent orchestration ──
    {
        "id": "orchestrator_worker",
        "name": "Orchestrator-Worker",
        "category": "multi_agent",
        "complexity": "medium",
        "icon": "👔",
        "tagline": "Supervisor routes specialists",
        "description": "Top-down hierarchy: orchestrator holds global memory, delegates to stateless worker specialists.",
        "example": "Enterprise assistant coordinating calendar, email, and CRM",
        "starter_prompt": "As orchestrator, decompose my request and delegate to SQL, search, and writer workers.",
    },
    {
        "id": "sequential_chain",
        "name": "Sequential Chain",
        "category": "multi_agent",
        "complexity": "medium",
        "icon": "⛓️",
        "tagline": "Pipeline A → B → C",
        "description": "Deterministic linear pipeline — each agent's output is the next agent's strict input.",
        "example": "Research → Write → SEO edit → Format",
        "starter_prompt": "Run a pipeline: Research Agent → Writer Agent → Editor Agent on my topic.",
    },
    {
        "id": "parallel_fanout",
        "name": "Parallel Fan-Out / Fan-In",
        "category": "multi_agent",
        "complexity": "high",
        "icon": "🔀",
        "tagline": "Concurrent specialists",
        "description": "Multiple agents analyze the same problem in parallel; a synthesizer merges independent findings.",
        "example": "Credit risk + fraud + market analysis → unified risk score",
        "starter_prompt": "Fan out parallel analysis on security, UX, and cost; fan in with a synthesizer summary.",
    },
    {
        "id": "swarm_p2p",
        "name": "Swarm (Peer-to-Peer)",
        "category": "multi_agent",
        "complexity": "high",
        "icon": "🐝",
        "tagline": "Decentralized delegation",
        "description": "No central boss — agents discover peers via MCP/A2A and delegate tasks dynamically.",
        "example": "Open-ended ops, gaming NPCs, supply-chain simulation",
        "starter_prompt": "Act as a peer swarm: discover capabilities, delegate subtasks, and merge peer results.",
    },
    {
        "id": "hierarchical",
        "name": "Hierarchical Supervisor",
        "category": "multi_agent",
        "complexity": "medium",
        "icon": "🏢",
        "tagline": "Supervisor → workers",
        "description": "Supervisor breaks goals into subtasks and delegates to researcher, builder, and reviewer roles.",
        "example": "Research → Write → Edit content pipeline",
        "starter_prompt": "As supervisor, break this goal into subtasks and delegate to researcher, builder, and reviewer roles.",
    },
    {
        "id": "multi_agent_swarm",
        "name": "Multi-Agent Swarm",
        "category": "multi_agent",
        "complexity": "high",
        "icon": "🌐",
        "tagline": "Parallel peer analysis",
        "description": "Security, UX, and performance specialists run in parallel, then merge findings.",
        "example": "Automated dev team reviews",
        "starter_prompt": "Spawn a swarm to analyze my project from security, UX, and performance in parallel.",
    },
    # ── Human-agent integration ──
    {
        "id": "hitl",
        "name": "Human-in-the-Loop",
        "category": "human_integration",
        "complexity": "critical",
        "icon": "✋",
        "tagline": "Approve before irreversible acts",
        "description": "Thinks and acts autonomously but pauses for explicit approval before deploys, emails, or destructive commands.",
        "example": "Production deploys, wire transfers, rm -rf, customer emails",
        "starter_prompt": "Plan my task but ask for approval before any irreversible or external action.",
    },
    {
        "id": "critic_generator",
        "name": "Critic-Generator Debate",
        "category": "human_integration",
        "complexity": "high",
        "icon": "⚔️",
        "tagline": "Adversarial refinement",
        "description": "Generator and critic agents debate for multiple rounds until the strategy is bulletproof.",
        "example": "Legal strategy, architecture reviews, security threat modeling",
        "starter_prompt": "Generate a strategy, have a critic attack it for 2 rounds, then present the hardened result.",
    },
    # ── Industry & enterprise ──
    {
        "id": "revenue_sdr",
        "name": "SDR / Prospecting Agent",
        "category": "industry",
        "complexity": "medium",
        "icon": "📈",
        "tagline": "Autonomous outbound sales",
        "description": "Monitors signals, writes personalized outreach, and schedules meetings on calendars.",
        "example": "Regie.ai, 11x.ai style prospecting pipelines",
        "starter_prompt": "Act as an SDR: research my prospect, draft personalized outreach, and propose a meeting slot.",
    },
    {
        "id": "support_resolution",
        "name": "Support Resolution Agent",
        "category": "industry",
        "complexity": "medium",
        "icon": "🎧",
        "tagline": "Resolve without routing",
        "description": "Connects to billing, logistics, and docs to issue refunds or fix orders autonomously.",
        "example": "Intercom Fin, Sierra-style support",
        "starter_prompt": "Resolve this customer issue end-to-end using available tools and policies.",
    },
    {
        "id": "software_engineer_cloud",
        "name": "Cloud Software Engineer",
        "category": "industry",
        "complexity": "high",
        "icon": "☁️",
        "tagline": "Ticket → shipped code",
        "description": "Takes a full ticket, spins a sandbox, writes code, runs tests, and fixes its own bugs.",
        "example": "Devin, OpenHands, Vellum-style cloud engineers",
        "starter_prompt": "Take this ticket like a cloud SWE: plan, implement, test, and iterate until tests pass.",
    },
    {
        "id": "secops_pentest",
        "name": "SecOps / Pentest Agent",
        "category": "industry",
        "complexity": "high",
        "icon": "🛡️",
        "tagline": "AI red team",
        "description": "Scans surfaces, simulates attacks, traces exploits, and drafts remediation reports.",
        "example": "Continuous penetration testing and compliance reports",
        "starter_prompt": "Perform a security review: enumerate risks, simulate attacks, and propose remediations.",
    },
    {
        "id": "idp_document",
        "name": "IDP Document Agent",
        "category": "industry",
        "complexity": "medium",
        "icon": "📄",
        "tagline": "Messy docs → structured data",
        "description": "Extracts terms from contracts, invoices, and forms into ERP-ready structured records.",
        "example": "Intelligent document processing for SAP/ERP",
        "starter_prompt": "Extract key fields from my document description and output structured JSON for ERP import.",
    },
    {
        "id": "compliance_regulatory",
        "name": "Compliance & Regulatory Agent",
        "category": "industry",
        "complexity": "critical",
        "icon": "⚖️",
        "tagline": "Audit against live rules",
        "description": "Tracks GDPR, tax, and finance regulations; audits internal policies against new legislation.",
        "example": "Legal/finance compliance monitoring",
        "starter_prompt": "Audit my described policy against GDPR and flag gaps with remediation steps.",
    },
    # ── Infrastructure & execution ──
    {
        "id": "edge_local",
        "name": "Edge / Local Agent",
        "category": "infrastructure",
        "complexity": "low",
        "icon": "📱",
        "tagline": "Local-first, private",
        "description": "Runs on-device with SLMs — zero latency, offline-capable, data never leaves the machine.",
        "example": "On-device assistants using compact models",
        "starter_prompt": "Answer locally and privately — minimize external calls, prefer fast concise responses.",
    },
    {
        "id": "cloud_sandbox",
        "name": "Cloud Sandbox Agent",
        "category": "infrastructure",
        "complexity": "high",
        "icon": "🖥️",
        "tagline": "Isolated VM execution",
        "description": "Provisions a secure remote container for heavy deps, datasets, and arbitrary terminal code.",
        "example": "Remote Linux sandboxes for safe code execution",
        "starter_prompt": "Execute this in a cloud sandbox: install deps, run commands safely, and report results.",
    },
    {
        "id": "browser_rpa",
        "name": "Browser / RPA Agent",
        "category": "infrastructure",
        "complexity": "medium",
        "icon": "🖱️",
        "tagline": "GUI automation",
        "description": "Clicks buttons, reads pixels, and fills forms when no clean API exists.",
        "example": "Puppeteer, Computer Use API workflows",
        "starter_prompt": "Automate this web workflow step-by-step as if using a browser like a human.",
    },
    # ── Memory & lifecycle ──
    {
        "id": "ephemeral",
        "name": "Ephemeral Agent",
        "category": "lifecycle",
        "complexity": "low",
        "icon": "💨",
        "tagline": "One task, then gone",
        "description": "Spins up for a single job with no memory carried into the next session.",
        "example": "CI code-review bot on one push",
        "starter_prompt": "Handle only this single task with no reference to past sessions.",
    },
    {
        "id": "persistent_memory",
        "name": "Persistent Memory Agent",
        "category": "lifecycle",
        "complexity": "medium",
        "icon": "🧬",
        "tagline": "Long-term profile",
        "description": "Builds a deep profile of codebase debt, preferences, and decisions across months.",
        "example": "Personal dev agent remembering past architectural choices",
        "starter_prompt": "Use long-term memory and taste rules to advise me with historical context.",
    },
    # ── CodeForge operational roles ──
    {
        "id": "conversational",
        "name": "Conversational Agent",
        "category": "operational",
        "complexity": "low",
        "icon": "💬",
        "tagline": "Chat, coach, explain",
        "description": "Plain-language dialogue — PRD discovery, Q&A, coaching non-technical users.",
        "example": "Customer support, AI coach, virtual receptionist",
        "starter_prompt": "I want to build an app. Ask me questions and guide me step by step — I don't know how to code.",
    },
    {
        "id": "task_orchestration",
        "name": "Task Orchestration Agent",
        "category": "operational",
        "complexity": "medium",
        "icon": "🔧",
        "tagline": "Talk → do",
        "description": "Executes real actions: APIs, files, databases, and multi-step workflows.",
        "example": "Schedule meetings, extract PDFs into CRM",
        "starter_prompt": "Take this task and execute it step by step using available tools.",
    },
    {
        "id": "coding_devops",
        "name": "Coding & DevOps Agent",
        "category": "operational",
        "complexity": "medium",
        "icon": "👨‍💻",
        "tagline": "Code, test, ship",
        "description": "Reads, writes, tests code; runs git, shell, and opens pull requests.",
        "example": "Claude Code, CI/CD security scanners",
        "starter_prompt": "Review my project, run tests, fix failures, and explain changes in plain language.",
    },
    {
        "id": "hermes",
        "name": "Hermes Agent",
        "category": "operational",
        "complexity": "high",
        "icon": "🏛️",
        "tagline": "Nous sidecar engine",
        "description": (
            "Runs the optional Hermes Agent sidecar — autonomous tool use, terminal, MCP, and gateway integrations. "
            "Requires Hermes on the API host (Settings → Agent engine)."
        ),
        "example": "Long-running autonomous tasks, tool-heavy workflows",
        "starter_prompt": "Use Hermes mode: plan autonomous steps, use tools, and report progress in plain language.",
    },
]


def list_agent_categories() -> list[dict[str, str]]:
    return [dict(row) for row in AGENT_CATEGORY_META]


def list_agents(*, category: str | None = None) -> list[dict[str, Any]]:
    if not category:
        return [dict(agent) for agent in AGENT_DEFINITIONS]
    return [dict(agent) for agent in AGENT_DEFINITIONS if agent["category"] == category]


def get_agent(agent_id: str) -> dict[str, Any] | None:
    for agent in AGENT_DEFINITIONS:
        if agent["id"] == agent_id:
            return dict(agent)
    return None


def normalize_agent_type(agent_type: str | None) -> AgentArchitecture:
    cleaned = (agent_type or "").strip().lower()
    if get_agent(cleaned):
        return cleaned  # type: ignore[return-value]
    return DEFAULT_AGENT_TYPE


def category_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for agent in AGENT_DEFINITIONS:
        cat = agent["category"]
        counts[cat] = counts.get(cat, 0) + 1
    return counts
