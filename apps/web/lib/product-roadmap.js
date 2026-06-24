/** Shared product roadmap data for /roadmap and marketing sections */



export const PRIMARY_WEDGE = {

  title: "India's affordable AI product partner",

  summary:

    "Go from idea to shipped software in one workspace — PRDs, code, git, automations, and INR billing. Built for founders who don't code yet and developers who want Claude Code–level workflows at a fair price.",

};



export const AUDIENCES = [

  {

    id: "founders",

    emoji: "💡",

    title: "Founders & indie builders",

    description:

      "Describe your app in plain language. Get a PRD, build plan, starter code, and Razorpay-ready billing — without hiring a dev team first.",

    highlights: ["PRD & user stories", "Step-by-step plans", "No coding required"],

    cta: { label: "Start with a PRD", href: "/login?next=/app" },

  },

  {

    id: "developers",

    emoji: "⌨️",

    title: "Developers in India",

    description:

      "Chat, edit code, review diffs, run terminal commands, and use git — in the browser, terminal, desktop, or VS Code. Same session everywhere.",

    highlights: ["Monaco IDE + LSP", "Git & shell sandbox", "30+ agent patterns"],

    cta: { label: "Open the IDE", href: "/login?next=/code" },

  },

  {

    id: "teams",

    emoji: "👥",

    title: "Teams & startups",

    description:

      "Shared project memory, delegated agent tasks, cowork automations, and team billing in INR — keep everyone aligned from plan to production.",

    highlights: ["Team workspaces", "Knowledge base", "Cowork automations"],

    cta: { label: "Explore teams", href: "/login?next=/team" },

  },

];



export const COMPARISON_COLUMNS = [
  { id: "codeforge", label: "CodeForge" },
  { id: "cursor", label: "Cursor" },
  { id: "claudeCode", label: "Claude Code" },
  { id: "bolt", label: "Bolt" },
  { id: "v0", label: "v0" },
  { id: "windsurf", label: "Windsurf" },
  { id: "replit", label: "Replit" },
];

export const COMPARISON_ROWS = [
  {
    area: "Primary focus",
    codeforge: "Idea → PRD → code → deploy (India-first, all-in-one)",
    cursor: "AI-native IDE, deep editor integration",
    claudeCode: "Terminal/repo-wide coding agent",
    bolt: "Prompt-to-app in browser",
    v0: "UI generation + Vercel deploy",
    windsurf: "IDE with agentic flows",
    replit: "Cloud IDE + Agent",
  },
  {
    area: "Pricing for India",
    codeforge: "INR plans + Razorpay/UPI",
    cursor: "USD subscription",
    claudeCode: "USD / Claude subscription",
    bolt: "USD credits",
    v0: "USD / Vercel billing",
    windsurf: "USD subscription",
    replit: "USD credits",
  },
  {
    area: "India business stack",
    codeforge: "Zoho Books + Tally connectors",
    cursor: "—",
    claudeCode: "—",
    bolt: "—",
    v0: "—",
    windsurf: "—",
    replit: "—",
  },
  {
    area: "Surfaces",
    codeforge: "Web, browser IDE, terminal, desktop, VS Code, mobile PWA",
    cursor: "Desktop IDE (primary)",
    claudeCode: "Terminal (primary)",
    bolt: "Browser builder",
    v0: "Web UI generator",
    windsurf: "Desktop IDE",
    replit: "Cloud IDE",
  },
  {
    area: "Non-coding automation",
    codeforge: "Cowork — scrape, schedule, browser tasks",
    cursor: "Limited / via extensions",
    claudeCode: "Coding-focused",
    bolt: "Limited",
    v0: "—",
    windsurf: "Limited",
    replit: "Replit Agent (coding)",
  },
  {
    area: "Public quality metrics",
    codeforge: "Live eval summary on /roadmap",
    cursor: "—",
    claudeCode: "—",
    bolt: "—",
    v0: "—",
    windsurf: "—",
    replit: "—",
  },
  {
    area: "Where we are catching up",
    codeforge: "Frontier model default, native mobile apps, enterprise SAML",
    cursor: "—",
    claudeCode: "—",
    bolt: "—",
    v0: "—",
    windsurf: "—",
    replit: "—",
  },
];



export const ROADMAP_PHASES = [

  {

    id: "a",

    title: "Phase A — Clarity & trust",

    timeframe: "Now → 4 weeks",

    goal: "Visitors understand who we serve; first session leads to a tangible win.",

    status: "shipped",

    items: [

      { label: "Premium landing + public roadmap", status: "shipped" },

      { label: "Audience-specific entry points", status: "shipped" },

      { label: "Published quality eval summary on /roadmap", status: "shipped" },

      { label: "Founder quick-start templates + scaffolds", status: "shipped" },

      { label: "In-product deploy checklist", status: "shipped" },

    ],

  },

  {

    id: "b",

    title: "Phase B — Founder wedge",

    timeframe: "4–10 weeks",

    goal: "Credible “build my MVP this weekend” flow.",

    status: "shipped",

    items: [

      { label: "Guided describe → PRD → plan → code (journey tracking)", status: "shipped" },

      { label: "Razorpay + Supabase template packs", status: "shipped" },

      { label: "In-product deploy checklist after agent runs", status: "shipped" },

      { label: "Live app preview / artifacts (HTML, React, Mermaid)", status: "shipped" },

      { label: "India SaaS + marketplace scaffolds", status: "shipped" },

      { label: "Hinglish onboarding copy", status: "shipped" },

      { label: "Builder case studies", status: "shipped" },

    ],

  },

  {

    id: "c",

    title: "Phase C — Developer wedge",

    timeframe: "8–16 weeks",

    goal: "Competitive solo-dev workflow at lower INR cost.",

    status: "shipped",

    items: [

      { label: "Web IDE + terminal + VS Code parity", status: "shipped" },

      { label: "/loop, /compact, /ultrareview", status: "shipped" },

      { label: "Routing confidence + CI quality gates", status: "shipped" },

      { label: "Inline edit (Ctrl+K)", status: "shipped" },

      { label: "AI Tab completion in /code", status: "shipped" },

      { label: "Parallel agent sessions UI", status: "shipped" },

    ],

  },

  {

    id: "d",

    title: "Phase D — Team & cowork",

    timeframe: "12–20 weeks",

    goal: "Team plan clearly beats solo for startups.",

    status: "shipped",

    items: [

      { label: "Team workspaces + knowledge base", status: "shipped" },

      { label: "Delegation + step approval", status: "shipped" },

      { label: "Cowork scrape + browser automation", status: "shipped" },

      { label: "Scheduled jobs + web notifications", status: "shipped" },

      { label: "Enterprise SSO + audit log", status: "shipped" },

      { label: "Zoho Books + Tally MCP connectors", status: "shipped" },

    ],

  },

  {

    id: "e",

    title: "Phase E — Scale",

    timeframe: "6–12 months",

    goal: "Differentiation beyond price.",

    status: "in_progress",

    items: [

      { label: "Voice input in chat", status: "shipped" },

      { label: "Design-to-code (Figma MCP + prompts)", status: "shipped" },

      { label: "Mobile companion PWA (/mobile)", status: "shipped" },

      { label: "Plugin marketplace (/extensions)", status: "shipped" },

      { label: "India integrations (Zoho, Tally)", status: "shipped" },

      { label: "Mumbai-region production hosting", status: "in_progress" },

      { label: "Native iOS/Android apps", status: "planned" },

    ],

  },

];



export const STATUS_LABELS = {

  shipped: "Shipped",

  in_progress: "In progress",

  planned: "Planned",

};


