import { useState } from "react";
import CodeWorkspace from "./CodeWorkspace";
import CoworkWorkspace from "./CoworkWorkspace";
import TeamWorkspace from "./TeamWorkspace";
import { DesktopAuthProvider, useDesktopAuth } from "./DesktopAuthContext";

const MODES = [
  { id: "code", label: "Code" },
  { id: "cowork", label: "Cowork" },
  { id: "team", label: "Team" },
];

function DesktopShell() {
  const { userId, setUserId, token, oidcEnabled, authMessage, authLoading, login, loginWithOidc, logout } =
    useDesktopAuth();
  const [mode, setMode] = useState("code");

  async function handleDevLogin() {
    try {
      await login(userId);
    } catch {
      // Error surfaced via authMessage.
    }
  }

  async function handleOidcLogin() {
    try {
      await loginWithOidc();
    } catch {
      // Error surfaced via authMessage.
    }
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
              <button type="button" className="ghost-btn inline-btn" onClick={logout} disabled={authLoading}>
                Logout
              </button>
            </>
          ) : oidcEnabled ? (
            <button type="button" onClick={handleOidcLogin} disabled={authLoading}>
              {authLoading ? "Signing in…" : "Sign in with SSO"}
            </button>
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
            </>
          )}
          {authMessage ? <span className="small desktop-auth-message">{authMessage}</span> : null}
        </div>
      </nav>
      {mode === "code" ? <CodeWorkspace /> : null}
      {mode === "cowork" ? <CoworkWorkspace /> : null}
      {mode === "team" ? <TeamWorkspace /> : null}
    </div>
  );
}

export default function App() {
  return (
    <DesktopAuthProvider>
      <DesktopShell />
    </DesktopAuthProvider>
  );
}
