export const STORAGE_KEY = "codeforge.desktop.auth";
export const LEGACY_CODE_STORAGE_KEY = "codeforge.desktop.code";
export const OIDC_STATE_KEY = "codeforge.desktop.oidc_state";

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

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CODE_STORAGE_KEY) || "{}");
    if (legacy.token || legacy.userId) {
      delete legacy.token;
      delete legacy.userId;
      localStorage.setItem(LEGACY_CODE_STORAGE_KEY, JSON.stringify(legacy));
    }
  } catch {
    // Ignore legacy parse errors.
  }
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
