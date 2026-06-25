/** English + Hinglish UI copy for founder onboarding */

export const LOCALES = {
  en: { id: "en", label: "English" },
  hinglish: { id: "hinglish", label: "Hinglish" },
};

const COPY = {
  en: {
    welcomeTitle: "What should we build today?",
    welcomeSub:
      "No coding experience needed. Describe your idea and the AI guides you from PRD → plan → build → ship.",
    quickStartLabel: "Quick start",
    composerPlaceholder: "Describe your app idea, a bug, or what you want to build…",
    composerHint: "Enter to send · Shift+Enter for new line",
    journeyLabel: "Your build journey",
    startChat: "Start a new chat",
    exploreFeatures: "Explore all features →",
    voiceLabel: "Voice input",
    parallelSessions: "Parallel sessions",
  },
  hinglish: {
    welcomeTitle: "Aaj kya banayein?",
    welcomeSub:
      "Coding ki zaroorat nahi. Apna idea batao — AI PRD se lekar plan, build aur ship tak guide karega.",
    quickStartLabel: "Quick start",
    composerPlaceholder: "App idea, bug, ya jo banana hai — simple Hindi/English mein likho…",
    composerHint: "Enter bhejo · Shift+Enter nayi line",
    journeyLabel: "Aapka build journey",
    startChat: "Nayi chat shuru karo",
    exploreFeatures: "Saari features dekho →",
    voiceLabel: "Bol kar type karo",
    parallelSessions: "Parallel sessions",
  },
};

export function getLocale() {
  if (typeof window === "undefined") {
    return "en";
  }
  const stored = localStorage.getItem("codeforge_locale");
  return stored === "hinglish" ? "hinglish" : "en";
}

export function setLocale(locale) {
  const next = locale === "hinglish" ? "hinglish" : "en";
  if (typeof window !== "undefined") {
    localStorage.setItem("codeforge_locale", next);
    window.dispatchEvent(new CustomEvent("codeforge:locale-change", { detail: next }));
  }
  return next;
}

export function t(key, locale = getLocale()) {
  return COPY[locale]?.[key] ?? COPY.en[key] ?? key;
}
