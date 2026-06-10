export const STORAGE_KEY = "codeforge.desktop.auth";
/** Workspace prefs (project path, session id) — not auth tokens. */
export const WORKSPACE_STORAGE_KEY = "codeforge.desktop.workspace";
export const LEGACY_CODE_STORAGE_KEY = "codeforge.desktop.code";
export const OIDC_STATE_KEY = "codeforge.desktop.oidc_state";

function readWorkspaceStorage() {
  try {
    const current = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) || "{}");
    if (Object.keys(current).length > 0) {
      return current;
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CODE_STORAGE_KEY) || "{}");
    const migrated = { ...legacy };
    delete migrated.token;
    delete migrated.userId;
    if (Object.keys(migrated).length > 0) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_CODE_STORAGE_KEY);
      return migrated;
    }
    return current;
  } catch {
    return {};
  }
}

export function loadWorkspaceState() {
  return readWorkspaceStorage();
}

export function saveWorkspaceState(patch) {
  const current = readWorkspaceStorage();
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export function clearWorkspaceState() {
  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  localStorage.removeItem(LEGACY_CODE_STORAGE_KEY);
}

export function loadDesktopAuth() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (current.token) {
      return current;
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_CODE_STORAGE_KEY) || "{}");
    if (legacy.token) {
      const migrated = {
        token: legacy.token,
        userId: legacy.userId || userIdFromToken(legacy.token),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return current;
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
  clearWorkspaceState();
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
