"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { completeOidcCallback, devLogin, getOidcAuthorizeUrl, getOidcConfig } from "./api";

const AuthContext = createContext(null);
const OIDC_STATE_KEY = "codeforge_oidc_state";

function userIdFromToken(accessToken) {
  if (accessToken.startsWith("oidc_")) {
    return accessToken.slice(5);
  }
  return accessToken.startsWith("dev_") ? accessToken.slice(4) : accessToken;
}

function persistSession(accessToken) {
  const resolvedUserId = userIdFromToken(accessToken);
  sessionStorage.setItem("codeforge_token", accessToken);
  sessionStorage.setItem("codeforge_user_id", resolvedUserId);
  return { accessToken, userId: resolvedUserId };
}

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("codeforge_token");
    const storedUserId = sessionStorage.getItem("codeforge_user_id");
    if (storedToken && storedUserId) {
      setToken(storedToken);
      setUserId(storedUserId);
    }
    getOidcConfig()
      .then((config) => setOidcEnabled(Boolean(config.enabled)))
      .catch(() => setOidcEnabled(false))
      .finally(() => setReady(true));
  }, []);

  async function login(nextUserId) {
    const trimmed = nextUserId.trim();
    const nextToken = await devLogin(trimmed);
    const session = persistSession(nextToken);
    setUserId(session.userId);
    setToken(session.accessToken);
    return session.accessToken;
  }

  async function loginWithOidc() {
    const config = await getOidcConfig();
    if (!config.enabled) {
      throw new Error("OIDC sign-in is not enabled");
    }

    const redirectUri =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : config.redirect_uri;
    const state = `cf_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    sessionStorage.setItem(OIDC_STATE_KEY, state);

    const result = await getOidcAuthorizeUrl(redirectUri, state);
    window.location.assign(result.authorize_url);
  }

  async function completeOidcLogin(code, state, redirectUri = null) {
    const expectedState = sessionStorage.getItem(OIDC_STATE_KEY);
    if (!expectedState || expectedState !== state) {
      throw new Error("OIDC state mismatch");
    }

    const resolvedRedirect =
      redirectUri || (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "");
    const nextToken = await completeOidcCallback({
      code,
      redirect_uri: resolvedRedirect,
      state,
    });
    sessionStorage.removeItem(OIDC_STATE_KEY);
    const session = persistSession(nextToken);
    setUserId(session.userId);
    setToken(session.accessToken);
    return session.accessToken;
  }

  function logout() {
    setToken(null);
    setUserId("");
    sessionStorage.removeItem("codeforge_token");
    sessionStorage.removeItem("codeforge_user_id");
    sessionStorage.removeItem(OIDC_STATE_KEY);
  }

  return (
    <AuthContext.Provider
      value={{ userId, token, ready, oidcEnabled, login, loginWithOidc, completeOidcLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
