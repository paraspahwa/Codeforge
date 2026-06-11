import { useState } from "react";
import AnalyticsWorkspace from "./AnalyticsWorkspace";
import BillingWorkspace from "./BillingWorkspace";
import CodeWorkspace from "./CodeWorkspace";
import CoworkWorkspace from "./CoworkWorkspace";
import SettingsWorkspace from "./SettingsWorkspace";
import TeamWorkspace from "./TeamWorkspace";
import { DesktopAuthProvider, useDesktopAuth } from "./DesktopAuthContext";
import { ToastProvider } from "./toast-context";

const MODE_GROUPS = [
  { label: "Build", modes: [{ id: "code", label: "Code" }] },
  { label: "Automate", modes: [{ id: "cowork", label: "Cowork" }] },
  { label: "Team", modes: [{ id: "team", label: "Team" }] },
  {
    label: "Account",
    modes: [
      { id: "analytics", label: "Analytics" },
      { id: "billing", label: "Billing" },
      { id: "settings", label: "Settings" },
    ],
  },
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

  if (!token) {
    return (
      <div className="desktop-shell desktop-login-shell">
        <div className="login-card">
          <div className="brand">CodeForge Desktop</div>
          <p className="small">India-first AI coding assistant — sign in to continue.</p>
          {oidcEnabled ? (
            <button type="button" onClick={handleOidcLogin} disabled={authLoading}>
              {authLoading ? "Signing in…" : "Sign in with SSO"}
            </button>
          ) : (
            <>
              <label className="small" htmlFor="desktopDevUser">
                Development user ID
              </label>
              <input
                id="desktopDevUser"
                aria-label="Dev user ID"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                disabled={authLoading}
              />
              <button type="button" onClick={handleDevLogin} disabled={authLoading || !userId.trim()}>
                {authLoading ? "Signing in…" : "Continue"}
              </button>
            </>
          )}
          {authMessage ? <p className="small desktop-auth-message">{authMessage}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-shell">
      <nav className="mode-nav">
        <div className="brand">CodeForge Desktop</div>
        <div className="mode-tabs">
          {MODE_GROUPS.map((group) => (
            <div key={group.label} className="mode-group">
              <span className="mode-group-label small">{group.label}</span>
              {group.modes.map((entry) => (
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
          ))}
        </div>
        <div className="desktop-auth-bar">
          <span className="small">
            Signed in as <strong>{userId}</strong>
          </span>
          <button type="button" className="ghost-btn inline-btn" onClick={logout} disabled={authLoading}>
            Logout
          </button>
        </div>
      </nav>
      {mode === "code" ? <CodeWorkspace /> : null}
      {mode === "cowork" ? <CoworkWorkspace /> : null}
      {mode === "team" ? <TeamWorkspace /> : null}
      {mode === "analytics" ? <AnalyticsWorkspace /> : null}
      {mode === "billing" ? <BillingWorkspace /> : null}
      {mode === "settings" ? <SettingsWorkspace /> : null}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DesktopAuthProvider>
        <DesktopShell />
      </DesktopAuthProvider>
    </ToastProvider>
  );
}
