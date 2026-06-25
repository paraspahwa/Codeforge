"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Input, Panel } from "@codeforge/ui";

import AuthLayout from "../../components/marketing/AuthLayout";
import { getDeployReadiness } from "../../lib/api";
import { needsOnboarding } from "../../lib/audience-preference";
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
    nativeEnabled,
    devEnabled,
    login,
    loginWithNative,
    loginWithOidc,
    loginWithSupabaseEmail,
    loginWithSupabaseMagicLink,
    loginWithSupabaseOAuth,
  } = useAuth();
  const toast = useToast();
  const [loginInput, setLoginInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [devLoginOpen, setDevLoginOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const prefillEmail = params.get("email");
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
    if (params.get("registered") === "1") {
      toast.push("Account created. Sign in with your email and password.", "success");
    }
  }, [toast]);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    if (needsOnboarding()) {
      router.replace(`/onboarding?next=${encodeURIComponent("/app")}`);
      return;
    }
    router.replace(nextPath.startsWith("/") && nextPath !== "/login" ? nextPath : "/app");
  }, [ready, token, router, nextPath]);

  useEffect(() => {
    getDeployReadiness(false)
      .then((readiness) => {
        const devBlocked = (readiness.checks || []).some(
          (check) =>
            (check.name === "dev_login_disabled_under_oidc" && check.ok) ||
            (check.name === "dev_login_disabled_in_production" && check.ok),
        );
        setShowDevLogin(devEnabled && !devBlocked);
      })
      .catch(() => setShowDevLogin(devEnabled));
  }, [devEnabled]);

  async function handleNativeLogin(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      return;
    }
    setLoggingIn(true);
    try {
      await loginWithNative(email, password);
      toast.push("Signed in", "success");
      if (needsOnboarding()) {
        router.replace(`/onboarding?next=${encodeURIComponent("/app")}`);
        return;
      }
      router.replace(nextPath.startsWith("/") && nextPath !== "/login" ? nextPath : "/app");
    } catch (error) {
      toast.push(error.message || "Invalid credentials");
    } finally {
      setLoggingIn(false);
    }
  }

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
    <AuthLayout>
    <div className="login-page mkt-auth-center">
      <Panel className="login-card mkt-auth-card">
        <div className="brand login-brand">
          <span className="brand-mark">CF</span>
          <span>CodeForge</span>
        </div>
        <p className="login-tagline mkt-auth-tagline">
          Sign in to sync cloud sessions, git workspaces, and team features.
        </p>

        {oidcEnabled ? (
          <>
            <Button type="button" onClick={handleOidcLogin} disabled={oidcLoading} className="login-primary-btn">
              {oidcLoading ? "Redirecting…" : "Sign in with SSO"}
            </Button>
          </>
        ) : null}

        {nativeEnabled ? (
          <div className={oidcEnabled ? "mt-6 login-section-divider" : ""}>
            {oidcEnabled ? <p className="small login-section-label">Or sign in with email</p> : null}
            <form onSubmit={handleNativeLogin} className="login-form">
              <label className="small" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loggingIn}
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
                disabled={loggingIn}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <Button
                type="submit"
                disabled={loggingIn || !email.trim() || !password}
                className="login-primary-btn"
              >
                {loggingIn ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="small mt-6">
              New here? <Link href="/signup">Create an account</Link>
            </p>
          </div>
        ) : null}

        {supabaseEnabled && !nativeEnabled ? (
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

        {showDevLogin ? (
          <>
            <button type="button" className="ghost-btn mt-6" onClick={() => setDevLoginOpen((open) => !open)}>
              {devLoginOpen ? "Hide development sign-in" : "Use development sign-in"}
            </button>
            {devLoginOpen ? (
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
                {loggingIn ? "Signing in…" : "Continue with dev login"}
              </Button>
            </form>
            ) : null}
          </>
        ) : null}

        <p className="small login-footer">
          <Link href="/">Back to home</Link>
          {" · "}
          <Link href="/pricing">View plans</Link>
        </p>
      </Panel>
    </div>
    </AuthLayout>
  );
}
