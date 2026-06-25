"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { completeOidcCallback, devLogin, getAuthConfig, getOidcAuthorizeUrl, getOidcConfig, loginWithCredentials, registerAccount } from "./api";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client";

const AuthContext = createContext(null);
const OIDC_STATE_KEY = "codeforge_oidc_state";

function decodeJwtPayload(accessToken) {
  if (!accessToken || accessToken.split(".").length !== 3) {
    return null;
  }
  try {
    return JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function decodeJwtSubject(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  return payload?.sub ? String(payload.sub) : null;
}

function userIdFromToken(accessToken) {
  if (accessToken.startsWith("oidc_")) {
    return accessToken.slice(5);
  }
  if (accessToken.startsWith("dev_")) {
    return accessToken.slice(4);
  }
  const subject = decodeJwtSubject(accessToken);
  if (subject) {
    return subject;
  }
  return accessToken;
}

function usernameFromToken(accessToken) {
  if (accessToken.startsWith("oidc_")) {
    return accessToken.slice(5);
  }
  if (accessToken.startsWith("dev_")) {
    return accessToken.slice(4);
  }
  const payload = decodeJwtPayload(accessToken);
  if (payload?.username) {
    return String(payload.username);
  }
  const subject = decodeJwtSubject(accessToken);
  if (subject) {
    return subject;
  }
  return userIdFromToken(accessToken);
}

async function syncServerSession(accessToken, userId) {
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, user_id: userId }),
  });
}

function persistSession(accessToken) {
  const resolvedUserId = userIdFromToken(accessToken);
  const resolvedUsername = usernameFromToken(accessToken);
  sessionStorage.setItem("codeforge_token", accessToken);
  sessionStorage.setItem("codeforge_user_id", resolvedUserId);
  sessionStorage.setItem("codeforge_username", resolvedUsername);
  void syncServerSession(accessToken, resolvedUserId);
  return { accessToken, userId: resolvedUserId, username: resolvedUsername };
}

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [supabaseEnabled, setSupabaseEnabled] = useState(false);
  const [nativeEnabled, setNativeEnabled] = useState(false);
  const [devEnabled, setDevEnabled] = useState(false);

  useEffect(() => {
    setSupabaseEnabled(isSupabaseConfigured());

    async function hydrateSession() {
      const storedToken = sessionStorage.getItem("codeforge_token");
      const storedUserId = sessionStorage.getItem("codeforge_user_id");
      if (storedToken && storedUserId) {
        setToken(storedToken);
        setUserId(storedUserId);
        setUsername(sessionStorage.getItem("codeforge_username") || usernameFromToken(storedToken));
        void syncServerSession(storedToken, storedUserId);
      } else {
        try {
          const response = await fetch("/api/auth/session");
          if (response.ok) {
            const data = await response.json();
            if (data.access_token && data.user_id) {
              sessionStorage.setItem("codeforge_token", data.access_token);
              sessionStorage.setItem("codeforge_user_id", data.user_id);
              sessionStorage.setItem(
                "codeforge_username",
                usernameFromToken(data.access_token),
              );
              setToken(data.access_token);
              setUserId(data.user_id);
              setUsername(usernameFromToken(data.access_token));
            }
          }
        } catch {
          // cookie session unavailable
        }
      }

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.access_token) {
            const next = persistSession(session.access_token);
            setUserId(next.userId);
            setUsername(next.username);
            setToken(next.accessToken);
          }
        });
      }

      getAuthConfig()
        .then((config) => {
          setNativeEnabled(Boolean(config.native_enabled));
          setSupabaseEnabled(Boolean(config.supabase_enabled) || isSupabaseConfigured());
          setOidcEnabled(Boolean(config.oidc_enabled));
          setDevEnabled(Boolean(config.dev_enabled));
        })
        .catch(() => {
          setSupabaseEnabled(isSupabaseConfigured());
          getOidcConfig()
            .then((config) => setOidcEnabled(Boolean(config.enabled)))
            .catch(() => setOidcEnabled(false));
        })
        .finally(() => setReady(true));
    }

    void hydrateSession();
  }, []);

  async function loginWithNative(email, password) {
    const nextToken = await loginWithCredentials({ email, password });
    const session = persistSession(nextToken);
    setUserId(session.userId);
    setUsername(session.username);
    setToken(session.accessToken);
    return session.accessToken;
  }

  async function registerWithNative(email, username, password) {
    const nextToken = await registerAccount({ email, username, password });
    const session = persistSession(nextToken);
    setUserId(session.userId);
    setUsername(session.username);
    setToken(session.accessToken);
    return session.accessToken;
  }

  async function login(nextUserId) {
    const trimmed = nextUserId.trim();
    const nextToken = await devLogin(trimmed);
    const session = persistSession(nextToken);
    setUserId(session.userId);
    setUsername(session.username);
    setToken(session.accessToken);
    return session.accessToken;
  }

  async function loginWithSupabaseEmail(email, password) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase Auth is not configured");
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      throw new Error(error.message);
    }
    if (!data.session?.access_token) {
      throw new Error("Sign-in succeeded but no session was returned");
    }
    const session = persistSession(data.session.access_token);
    setUserId(session.userId);
    setUsername(session.username);
    setToken(session.accessToken);
    return session.accessToken;
  }

  async function loginWithSupabaseMagicLink(email) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase Auth is not configured");
    }
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback?provider=supabase` : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async function loginWithSupabaseOAuth(provider) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase Auth is not configured");
    }
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback?provider=supabase` : undefined;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      throw new Error(error.message);
    }
    if (data?.url) {
      window.location.assign(data.url);
    }
  }

  async function completeSupabaseCallback() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase Auth is not configured");
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    if (!data.session?.access_token) {
      throw new Error("No Supabase session found after redirect");
    }
    const session = persistSession(data.session.access_token);
    setUserId(session.userId);
    setUsername(session.username);
    setToken(session.accessToken);
    return session.accessToken;
  }

  async function loginWithOidc() {
    const config = await getOidcConfig();
    if (!config.enabled) {
      throw new Error("OIDC sign-in is not enabled");
    }

    const redirectUri =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : config.redirect_uri;
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
    setUsername(session.username);
    setToken(session.accessToken);
    return session.accessToken;
  }

  async function logout() {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    await fetch("/api/auth/logout", { method: "POST" });
    setToken(null);
    setUserId("");
    setUsername("");
    sessionStorage.removeItem("codeforge_token");
    sessionStorage.removeItem("codeforge_user_id");
    sessionStorage.removeItem("codeforge_username");
    sessionStorage.removeItem(OIDC_STATE_KEY);
  }

  return (
    <AuthContext.Provider
      value={{
        userId,
        username,
        token,
        ready,
        oidcEnabled,
        supabaseEnabled,
        nativeEnabled,
        devEnabled,
        login,
        loginWithNative,
        registerWithNative,
        loginWithOidc,
        loginWithSupabaseEmail,
        loginWithSupabaseMagicLink,
        loginWithSupabaseOAuth,
        completeOidcLogin,
        completeSupabaseCallback,
        logout,
      }}
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
