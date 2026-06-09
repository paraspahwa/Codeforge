import { createContext, useContext, useEffect, useState } from "react";

import { completeOidcCallback, devLogin, getOidcAuthorizeUrl, getOidcConfig } from "./api";
import {
  OIDC_STATE_KEY,
  clearDesktopAuth,
  desktopRedirectUri,
  isOidcCallbackPath,
  loadDesktopAuth,
  saveDesktopAuth,
  userIdFromToken,
} from "./desktop-auth";

const DesktopAuthContext = createContext(null);

export function DesktopAuthProvider({ children }) {
  const stored = loadDesktopAuth();
  const [userId, setUserId] = useState(import.meta.env.VITE_CODEFORGE_USER_ID || stored.userId || "dev-user");
  const [token, setToken] = useState(stored.token || null);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getOidcConfig()
      .then((config) => setOidcEnabled(Boolean(config.enabled)))
      .catch(() => setOidcEnabled(false))
      .finally(() => setReady(true));
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

  async function login(nextUserId) {
    const trimmed = nextUserId.trim();
    setAuthLoading(true);
    setAuthMessage("");
    try {
      const accessToken = await devLogin(trimmed);
      setToken(accessToken);
      setUserId(trimmed);
      saveDesktopAuth({ token: accessToken, userId: trimmed });
      setAuthMessage(`Logged in as ${trimmed}`);
      return accessToken;
    } catch (error) {
      setAuthMessage(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  async function loginWithOidc() {
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
      throw error;
    }
  }

  function logout() {
    setToken(null);
    clearDesktopAuth();
    setAuthMessage("Logged out");
  }

  return (
    <DesktopAuthContext.Provider
      value={{
        userId,
        setUserId,
        token,
        ready,
        oidcEnabled,
        authMessage,
        authLoading,
        login,
        loginWithOidc,
        logout,
      }}
    >
      {children}
    </DesktopAuthContext.Provider>
  );
}

export function useDesktopAuth() {
  const context = useContext(DesktopAuthContext);
  if (!context) {
    throw new Error("useDesktopAuth must be used inside DesktopAuthProvider");
  }
  return context;
}
