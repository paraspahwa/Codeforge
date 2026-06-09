const STORAGE_KEY = "codeforge.desktop.auth";
const OIDC_STATE_KEY = "codeforge.desktop.oidc_state";

export function loadDesktopAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveDesktopAuth(patch) {
  const current = loadDesktopAuth();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export function clearDesktopAuth() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(OIDC_STATE_KEY);
}

export function userIdFromToken(accessToken) {
  if (accessToken.startsWith("oidc_")) {
    return accessToken.slice(5);
  }
  if (accessToken.startsWith("dev_")) {
    return accessToken.slice(4);
  }
  return accessToken;
}

export function desktopRedirectUri() {
  if (typeof window === "undefined") {
    return "http://localhost:1420/auth/callback";
  }
  return `${window.location.origin}/auth/callback`;
}

export function isOidcCallbackPath() {
  return typeof window !== "undefined" && window.location.pathname.endsWith("/auth/callback");
}
