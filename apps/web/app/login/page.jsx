"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Input, Panel } from "@codeforge/ui";

import { getDeployReadiness } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

export default function LoginPage() {
  const router = useRouter();
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") {
      return "/";
    }
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") ? next : "/";
  }, []);
  const { token, ready, oidcEnabled, login, loginWithOidc } = useAuth();
  const toast = useToast();
  const [loginInput, setLoginInput] = useState("dev-user");
  const [loggingIn, setLoggingIn] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [devLoginAllowed, setDevLoginAllowed] = useState(true);
  const [showDevLogin, setShowDevLogin] = useState(false);

  useEffect(() => {
    if (ready && token) {
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
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
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
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
              Redirect URI: <code>{typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "/auth/callback"}</code>
            </p>
            {devLoginAllowed ? (
              <>
                <button
                  type="button"
                  className="ghost-btn mt-6"
                  onClick={() => setShowDevLogin((open) => !open)}
                >
                  {showDevLogin ? "Hide development sign-in" : "Use development sign-in"}
                </button>
                {showDevLogin ? (
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
          </>
        ) : (
          <form onSubmit={handleDevLogin} className="login-form">
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
              {loggingIn ? "Signing in…" : "Continue"}
            </Button>
          </form>
        )}
        <p className="small login-footer">
          <Link href="/billing">View plans</Link>
        </p>
      </Panel>
    </div>
  );
}
