"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { completeOidcCallback, devLogin, getOidcAuthorizeUrl, getOidcConfig } from "./api";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client";

const AuthContext = createContext(null);
const OIDC_STATE_KEY = "codeforge_oidc_state";

function decodeJwtSubject(accessToken) {
  if (!accessToken || accessToken.split(".").length !== 3) {
    return null;
  }
  try {
    const payload = JSON.parse(
      atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
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

async function syncServerSession(accessToken, userId) {
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, user_id: userId }),
  });
}

function persistSession(accessToken) {
  const resolvedUserId = userIdFromToken(accessToken);
  sessionStorage.setItem("codeforge_token", accessToken);
  sessionStorage.setItem("codeforge_user_id", resolvedUserId);
  void syncServerSession(accessToken, resolvedUserId);
  return { accessToken, userId: resolvedUserId };
}

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [supabaseEnabled, setSupabaseEnabled] = useState(false);

  useEffect(() => {
    setSupabaseEnabled(isSupabaseConfigured());

    async function hydrateSession() {
      const storedToken = sessionStorage.getItem("codeforge_token");
      const storedUserId = sessionStorage.getItem("codeforge_user_id");
      if (storedToken && storedUserId) {
        setToken(storedToken);
        setUserId(storedUserId);
        void syncServerSession(storedToken, storedUserId);
      } else {
        try {
          const response = await fetch("/api/auth/session");
          if (response.ok) {
            const data = await response.json();
            if (data.access_token && data.user_id) {
              sessionStorage.setItem("codeforge_token", data.access_token);
              sessionStorage.setItem("codeforge_user_id", data.user_id);
              setToken(data.access_token);
              setUserId(data.user_id);
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
            setToken(next.accessToken);
          }
        });
      }

      getOidcConfig()
        .then((config) => setOidcEnabled(Boolean(config.enabled)))
        .catch(() => setOidcEnabled(false))
        .finally(() => setReady(true));
    }

    void hydrateSession();
  }, []);

  async function login(nextUserId) {
    const trimmed = nextUserId.trim();
    const nextToken = await devLogin(trimmed);
    const session = persistSession(nextToken);
    setUserId(session.userId);
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
    sessionStorage.removeItem("codeforge_token");
    sessionStorage.removeItem("codeforge_user_id");
    sessionStorage.removeItem(OIDC_STATE_KEY);
  }

  return (
    <AuthContext.Provider
      value={{
        userId,
        token,
        ready,
        oidcEnabled,
        supabaseEnabled,
        login,
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
