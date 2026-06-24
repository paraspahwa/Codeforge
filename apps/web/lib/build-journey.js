/** Persisted founder build journey (describe → PRD → plan → code → fix) */

const STORAGE_KEY = "codeforge_build_journey";

export const JOURNEY_STEPS = [
  { step: 1, key: "describe", title: "Describe your idea" },
  { step: 2, key: "prd", title: "Create a PRD" },
  { step: 3, key: "plan", title: "Plan & review" },
  { step: 4, key: "build", title: "Build & ship" },
  { step: 5, key: "fix", title: "Fix & secure" },
];

function readState() {
  if (typeof window === "undefined") {
    return { currentStep: 1, completed: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { currentStep: 1, completed: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      currentStep: Number(parsed.currentStep) || 1,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
    };
  } catch {
    return { currentStep: 1, completed: [] };
  }
}

function writeState(state) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getBuildJourneyState() {
  return readState();
}

export function detectJourneyStepFromText(text) {
  const lowered = String(text || "").toLowerCase();
  if (/security|vulnerabilit|audit/.test(lowered)) {
    return 5;
  }
  if (/implement|build|scaffold|create file|write code|ship/.test(lowered)) {
    return 4;
  }
  if (/plan|milestone|phase|roadmap/.test(lowered)) {
    return 3;
  }
  if (/prd|product requirements|user stor/.test(lowered)) {
    return 2;
  }
  if (/idea|app|mvp|startup|marketplace|saas/.test(lowered)) {
    return 1;
  }
  return null;
}

export function advanceBuildJourney(step) {
  const next = Math.min(5, Math.max(1, Number(step) || 1));
  const state = readState();
  const completed = new Set(state.completed);
  for (let index = 1; index < next; index += 1) {
    completed.add(index);
  }
  const updated = { currentStep: next, completed: [...completed].sort((a, b) => a - b) };
  writeState(updated);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("codeforge:journey-change", { detail: updated }));
  }
  return updated;
}

export function markJourneyStepComplete(step) {
  const state = readState();
  const completed = new Set(state.completed);
  completed.add(step);
  const currentStep = Math.min(5, step + 1);
  const updated = { currentStep, completed: [...completed].sort((a, b) => a - b) };
  writeState(updated);
  return updated;
}

export function resetBuildJourney() {
  const fresh = { currentStep: 1, completed: [] };
  writeState(fresh);
  return fresh;
}
