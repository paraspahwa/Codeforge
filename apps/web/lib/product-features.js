export const BUILD_JOURNEY = [
  {
    step: 1,
    title: "Describe your idea",
    description: "Tell the AI what you want to build — no coding needed.",
    icon: "💡",
    color: "#f59e0b",
  },
  {
    step: 2,
    title: "Create a PRD",
    description: "Turn your idea into a clear product requirements doc.",
    icon: "📋",
    color: "#8b5cf6",
  },
  {
    step: 3,
    title: "Plan & review",
    description: "Approve each step before anything gets built.",
    icon: "🗺️",
    color: "#06b6d4",
  },
  {
    step: 4,
    title: "Build & ship",
    description: "The agent writes code, runs tests, and ships for you.",
    icon: "🚀",
    color: "#10b981",
  },
  {
    step: 5,
    title: "Fix & secure",
    description: "Squash bugs and lock down security issues.",
    icon: "🛡️",
    color: "#ef4444",
  },
];

export const FEATURE_CATEGORIES = [
  {
    id: "start",
    title: "Start building",
    description: "Your AI product partner — just describe what you want.",
    emoji: "✨",
    features: [
      {
        id: "ai-partner",
        title: "AI product partner",
        description: "Chat in plain English. The agent asks questions, explains next steps, and handles the technical work.",
        icon: "💬",
        href: "/",
        action: "goal",
        starterPrompt:
          "I want to build an app. Please ask me clarifying questions about users and goals, then tell me what we should do first (PRD, plan, or prototype). I don't know how to code.",
      },
      {
        id: "prd",
        title: "Write a PRD",
        description: "Create a product requirements document — features, users, and success criteria.",
        icon: "📋",
        href: "/",
        action: "goal",
        starterPrompt:
          "Help me write a Product Requirements Document (PRD) for my app idea. Ask me 4-5 clarifying questions first — do NOT write the PRD yet. Only ask questions about users, problem, features, and success metrics.",
      },
      {
        id: "implementation-plan",
        title: "Create a build plan",
        description: "Break your idea into phases and milestones before any code is written.",
        icon: "🗺️",
        href: "/",
        action: "goal",
        planMode: true,
        starterPrompt:
          "Based on my app idea, create an implementation plan with phases (discovery, design, build, test, launch). Explain each phase in simple terms and what you will do for me.",
      },
    ],
  },
  {
    id: "build",
    title: "Build & ship",
    description: "Turn plans into working software.",
    emoji: "🔨",
    features: [
      {
        id: "implement",
        title: "Build my app",
        description: "The agent writes files, runs commands, and explains every change.",
        icon: "🏗️",
        href: "/",
        action: "goal",
        starterPrompt:
          "Let's start building my app. Work step by step, explain what you're doing in plain language, and ask before making big changes.",
      },
      {
        id: "cowork",
        title: "Automations (Cowork)",
        description: "Organize files, extract web data, and run multi-step workflows.",
        icon: "🤝",
        href: "/cowork",
      },
      {
        id: "code-view",
        title: "Code view",
        description: "See and edit files directly — for hands-on control.",
        icon: "⌨️",
        href: "/code",
      },
      {
        id: "publish",
        title: "Publish changes",
        description: "Save progress, push to GitHub, and open pull requests.",
        icon: "📤",
        href: "/",
        action: "goal",
        starterPrompt:
          "Help me publish my latest changes. Check what's ready, explain the steps in plain language, then stage, commit, and create a pull request if I approve.",
      },
    ],
  },
  {
    id: "quality",
    title: "Bugs & security",
    description: "Keep your app reliable and safe.",
    emoji: "🛡️",
    features: [
      {
        id: "debug",
        title: "Fix a bug",
        description: "Describe what's broken — the agent diagnoses, fixes, and verifies.",
        icon: "🐛",
        href: "/",
        action: "goal",
        starterPrompt:
          "Something is broken in my app. I'll describe the problem — please help me reproduce it, find the cause, fix it safely, and run tests to confirm.",
      },
      {
        id: "test-loop",
        title: "Auto-fix test failures",
        description: "Run tests until everything passes — no terminal knowledge needed.",
        icon: "🔄",
        href: "/",
        action: "goal",
        starterPrompt:
          "Run the project's tests, and if anything fails, fix the issues with minimal safe changes. Explain what failed and what you fixed in plain language.",
      },
      {
        id: "security",
        title: "Security review",
        description: "Scan for vulnerabilities, explain risks, and recommend fixes.",
        icon: "🔒",
        href: "/",
        action: "goal",
        planMode: true,
        starterPrompt:
          "Review my project for security issues (auth, secrets, injection, dependencies). Explain findings in plain language and propose fixes before applying anything.",
      },
      {
        id: "ultrareview",
        title: "Quality review",
        description: "Deep review for correctness, edge cases, and maintainability.",
        icon: "🔍",
        href: "/",
        action: "goal",
        planMode: true,
        starterPrompt:
          "Do a thorough quality review of recent changes. Flag bugs, missing tests, and risky patterns. Explain everything in terms I can understand without coding experience.",
      },
    ],
  },
  {
    id: "collaborate",
    title: "Collaborate",
    description: "Work with your team and track progress.",
    emoji: "👥",
    features: [
      {
        id: "sessions",
        title: "My chats",
        description: "Browse past conversations labeled by what you asked.",
        icon: "🗂️",
        href: "/sessions",
      },
      {
        id: "team",
        title: "Team workspace",
        description: "Share sessions, delegate tasks, and collaborate.",
        icon: "🤝",
        href: "/team",
      },
      {
        id: "analytics",
        title: "Usage & reliability",
        description: "See usage stats and how automations are performing.",
        icon: "📊",
        href: "/analytics",
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    description: "Billing and preferences.",
    emoji: "⚙️",
    features: [
      {
        id: "billing",
        title: "Billing & plans",
        description: "Manage your subscription and request limits.",
        icon: "💳",
        href: "/billing",
      },
      {
        id: "settings",
        title: "Settings",
        description: "Approval mode, plan mode, and agent preferences.",
        icon: "🎛️",
        href: "/settings",
      },
    ],
  },
];

export const PENDING_GOAL_STORAGE_KEY = "codeforge_pending_goal";

export function queueChatGoal({ prompt, planMode = false }) {
  if (typeof window === "undefined" || !prompt?.trim()) {
    return;
  }
  window.sessionStorage.setItem(
    PENDING_GOAL_STORAGE_KEY,
    JSON.stringify({ prompt: prompt.trim(), planMode: Boolean(planMode) }),
  );
}

export function consumePendingChatGoal() {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(PENDING_GOAL_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  window.sessionStorage.removeItem(PENDING_GOAL_STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.prompt) {
      return null;
    }
    return { prompt: String(parsed.prompt), planMode: Boolean(parsed.planMode) };
  } catch {
    return null;
  }
}
