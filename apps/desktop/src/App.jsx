import { useEffect, useState } from "react";
import CodeWorkspace from "./CodeWorkspace";
import CoworkWorkspace from "./CoworkWorkspace";
import TeamWorkspace from "./TeamWorkspace";
import {
  clearDesktopAuth,
  desktopRedirectUri,
  isOidcCallbackPath,
  loadDesktopAuth,
  saveDesktopAuth,
  userIdFromToken,
} from "./desktop-auth";
import { completeOidcCallback, devLogin, getOidcAuthorizeUrl, getOidcConfig } from "./api";

const MODES = [
  { id: "code", label: "Code" },
  { id: "cowork", label: "Cowork" },
  { id: "team", label: "Team" },
];

const OIDC_STATE_KEY = "codeforge.desktop.oidc_state";

export default function App() {
  const stored = loadDesktopAuth();
  const [mode, setMode] = useState("code");
  const [userId, setUserId] = useState(import.meta.env.VITE_CODEFORGE_USER_ID || stored.userId || "dev-user");
  const [token, setToken] = useState(stored.token || null);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    getOidcConfig()
      .then((config) => setOidcEnabled(Boolean(config.enabled)))
      .catch(() => setOidcEnabled(false));
  }, []);

  useEffect(() => {
    if (!isOidcCallbackPath()) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      setAuthMessage(`OIDC sign-in failed: ${error}`);
      window.history.replaceState({}, "", "/");
      return;
    }

    if (!code || !state) {
      setAuthMessage("OIDC callback missing code or state.");
      window.history.replaceState({}, "", "/");
      return;
    }

    const expectedState = localStorage.getItem(OIDC_STATE_KEY);
    if (!expectedState || expectedState !== state) {
      setAuthMessage("OIDC state mismatch.");
      window.history.replaceState({}, "", "/");
      return;
    }

    setAuthLoading(true);
    completeOidcCallback({ code, redirect_uri: desktopRedirectUri(), state })
      .then((accessToken) => {
        const resolvedUserId = userIdFromToken(accessToken);
        setToken(accessToken);
        setUserId(resolvedUserId);
        saveDesktopAuth({ token: accessToken, userId: resolvedUserId });
        localStorage.removeItem(OIDC_STATE_KEY);
        setAuthMessage(`Signed in as ${resolvedUserId}`);
      })
      .catch((callbackError) => {
        setAuthMessage(callbackError.message);
      })
      .finally(() => {
        setAuthLoading(false);
        window.history.replaceState({}, "", "/");
      });
  }, []);

  async function handleDevLogin() {
    setAuthLoading(true);
    setAuthMessage("");
    try {
      const accessToken = await devLogin(userId.trim());
      setToken(accessToken);
      saveDesktopAuth({ token: accessToken, userId: userId.trim() });
      setAuthMessage(`Logged in as ${userId.trim()}`);
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleOidcLogin() {
    setAuthLoading(true);
    setAuthMessage("");
    try {
      const redirectUri = desktopRedirectUri();
      const state = `cf_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      localStorage.setItem(OIDC_STATE_KEY, state);
      const result = await getOidcAuthorizeUrl(redirectUri, state);
      window.location.assign(result.authorize_url);
    } catch (error) {
      setAuthMessage(error.message);
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setToken(null);
    clearDesktopAuth();
    setAuthMessage("Logged out");
  }

  return (
    <div className="desktop-shell">
      <nav className="mode-nav">
        <div className="brand">CodeForge Desktop</div>
        <div className="mode-tabs">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={mode === entry.id ? "mode-tab mode-tab-active" : "mode-tab"}
              onClick={() => setMode(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="desktop-auth-bar">
          {token ? (
            <>
              <span className="small">
                Signed in as <strong>{userId}</strong>
              </span>
              <button type="button" className="ghost-btn inline-btn" onClick={handleLogout} disabled={authLoading}>
                Logout
              </button>
            </>
          ) : (
            <>
              <input
                aria-label="Dev user ID"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                disabled={authLoading}
              />
              <button type="button" onClick={handleDevLogin} disabled={authLoading || !userId.trim()}>
                {authLoading ? "Signing in…" : "Login"}
              </button>
              {oidcEnabled ? (
                <button type="button" className="ghost-btn inline-btn" onClick={handleOidcLogin} disabled={authLoading}>
                  Sign in with SSO
                </button>
              ) : null}
            </>
          )}
          {authMessage ? <span className="small desktop-auth-message">{authMessage}</span> : null}
        </div>
      </nav>
      {mode === "code" ? <CodeWorkspace sharedToken={token} sharedUserId={userId} /> : null}
      {mode === "cowork" ? <CoworkWorkspace sharedToken={token} sharedUserId={userId} /> : null}
      {mode === "team" ? <TeamWorkspace sharedToken={token} sharedUserId={userId} /> : null}
    </div>
  );
}
