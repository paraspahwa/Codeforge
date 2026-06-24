"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Input, Panel } from "@codeforge/ui";

import { getDeployReadiness } from "../../lib/api";
import { audienceHomePath, getAudiencePreference, needsOnboarding } from "../../lib/audience-preference";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

export default function LoginPage() {
  const router = useRouter();
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") {
      return "/app";
    }
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") ? next : "/app";
  }, []);
  const {
    token,
    ready,
    oidcEnabled,
    supabaseEnabled,
    login,
    loginWithOidc,
    loginWithSupabaseEmail,
    loginWithSupabaseMagicLink,
    loginWithSupabaseOAuth,
  } = useAuth();
  const toast = useToast();
  const [loginInput, setLoginInput] = useState("dev-user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [devLoginAllowed, setDevLoginAllowed] = useState(true);
  const [showDevLogin, setShowDevLogin] = useState(false);

  useEffect(() => {
    if (ready && token) {
      if (needsOnboarding() && nextPath !== "/onboarding") {
        router.replace(`/onboarding?next=${encodeURIComponent(nextPath)}`);
        return;
      }
      const audience = getAudiencePreference();
      const fallback = audience ? audienceHomePath(audience) : "/app";
      router.replace(nextPath.startsWith("/") && nextPath !== "/login" ? nextPath : fallback);
    }
  }, [ready, token, router, nextPath]);

  useEffect(() => {
    getDeployReadiness(false)
      .then((readiness) => {
        const devBlocked = (readiness.checks || []).some(
          (check) =>
            (check.name === "dev_login_disabled_under_oidc" && check.ok) ||
            (check.name === "dev_login_disabled_in_production" && check.ok),
        );
        setDevLoginAllowed(!devBlocked);
        setShowDevLogin(!devBlocked);
      })
      .catch(() => {
        setDevLoginAllowed(true);
        setShowDevLogin(true);
      });
  }, []);

  async function handleDevLogin(event) {
    event.preventDefault();
    if (!loginInput.trim()) {
      return;
    }
    setLoggingIn(true);
    try {
      await login(loginInput);
      toast.push("Logged in", "success");
      router.replace(nextPath.startsWith("/") ? nextPath : "/app");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleOidcLogin() {
    setOidcLoading(true);
    try {
      await loginWithOidc();
    } catch (error) {
      toast.push(error.message);
      setOidcLoading(false);
    }
  }

  async function handleSupabaseEmailLogin(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      return;
    }
    setSupabaseLoading(true);
    try {
      await loginWithSupabaseEmail(email, password);
      toast.push("Signed in", "success");
      router.replace(nextPath);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setSupabaseLoading(false);
    }
  }

  async function handleMagicLink(event) {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }
    setSupabaseLoading(true);
    try {
      await loginWithSupabaseMagicLink(email);
      setMagicLinkSent(true);
      toast.push("Check your email for a sign-in link", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setSupabaseLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setSupabaseLoading(true);
    try {
      await loginWithSupabaseOAuth("google");
    } catch (error) {
      toast.push(error.message);
      setSupabaseLoading(false);
    }
  }

  return (
    <div className="login-page">
      <Panel className="login-card">
        <div className="brand login-brand">
          <span className="brand-mark">CF</span>
          <span>CodeForge</span>
        </div>
        <p className="login-tagline">India-first AI coding assistant — affordable, powerful, trustworthy.</p>

        {oidcEnabled ? (
          <>
            <Button type="button" onClick={handleOidcLogin} disabled={oidcLoading} className="login-primary-btn">
              {oidcLoading ? "Redirecting…" : "Sign in with SSO"}
            </Button>
            <p className="small login-tagline mt-6">
              Redirect URI:{" "}
              <code>{typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "/auth/callback"}</code>
            </p>
          </>
        ) : null}

        {supabaseEnabled ? (
          <div className={oidcEnabled ? "mt-6 login-section-divider" : ""}>
            {oidcEnabled ? <p className="small login-section-label">Or sign in with email</p> : null}
            <form onSubmit={handleSupabaseEmailLogin} className="login-form">
              <label className="small" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={supabaseLoading}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <label className="small" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={supabaseLoading}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <Button
                type="submit"
                disabled={supabaseLoading || !email.trim() || !password}
                className="login-primary-btn"
              >
                {supabaseLoading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <div className="login-alt-actions mt-6">
              <button type="button" className="ghost-btn" onClick={handleMagicLink} disabled={supabaseLoading || !email.trim()}>
                Email me a magic link
              </button>
              <button type="button" className="ghost-btn" onClick={handleGoogleLogin} disabled={supabaseLoading}>
                Continue with Google
              </button>
            </div>
            {magicLinkSent ? (
              <p className="small mt-6">Magic link sent. Check your inbox to finish signing in.</p>
            ) : null}
          </div>
        ) : null}

        {devLoginAllowed && (!oidcEnabled && !supabaseEnabled || showDevLogin) ? (
          <>
            {oidcEnabled || supabaseEnabled ? (
              <button type="button" className="ghost-btn mt-6" onClick={() => setShowDevLogin((open) => !open)}>
                {showDevLogin ? "Hide development sign-in" : "Use development sign-in"}
              </button>
            ) : null}
            {(showDevLogin || (!oidcEnabled && !supabaseEnabled)) && (
              <form onSubmit={handleDevLogin} className="login-form mt-6">
                <label className="small" htmlFor="devUserId">
                  Development user ID
                </label>
                <Input
                  id="devUserId"
                  value={loginInput}
                  onChange={(event) => setLoginInput(event.target.value)}
                  disabled={loggingIn}
                  placeholder="dev-user"
                />
                <Button type="submit" disabled={loggingIn || !loginInput.trim()} className="login-primary-btn">
                  {loggingIn ? "Signing in…" : oidcEnabled || supabaseEnabled ? "Continue with dev login" : "Continue"}
                </Button>
              </form>
            )}
          </>
        ) : null}

        <p className="small login-footer">
          <Link href="/">Back to home</Link>
          {" · "}
          <Link href="/pricing">View plans</Link>
        </p>
      </Panel>
    </div>
  );
}
