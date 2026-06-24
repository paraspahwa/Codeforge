/** First-run audience preference: founder vs developer */

const STORAGE_KEY = "codeforge_audience";

export function getAudiencePreference() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "founder" || value === "developer" ? value : null;
}

export function setAudiencePreference(audience) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, audience);
}

export function audienceHomePath(audience) {
  return audience === "developer" ? "/code" : "/app";
}

export function needsOnboarding() {
  return getAudiencePreference() === null;
}
