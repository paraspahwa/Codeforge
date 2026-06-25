"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Input, Panel } from "@codeforge/ui";

import AuthLayout from "../../components/marketing/AuthLayout";
import { registerAccount } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

export default function SignupPage() {
  const router = useRouter();
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") {
      return "/app";
    }
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") ? next : "/app";
  }, []);
  const { token, ready, nativeEnabled } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && token) {
      router.replace("/app");
    }
  }, [ready, token, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !username.trim() || !password) {
      return;
    }
    if (password !== confirmPassword) {
      toast.push("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await registerAccount({ email, username, password });
      toast.push("Account created — sign in to continue", "success");
      const params = new URLSearchParams({
        registered: "1",
        email: email.trim(),
        next: nextPath,
      });
      router.replace(`/login?${params.toString()}`);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (ready && !nativeEnabled) {
    return (
      <AuthLayout>
      <div className="login-page mkt-auth-center">
        <Panel className="login-card mkt-auth-card">
          <h1>Sign up unavailable</h1>
          <p className="small">Email sign-up is not enabled on this deployment.</p>
          <p className="small login-footer">
            <Link href="/login">Back to sign in</Link>
          </p>
        </Panel>
      </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
    <div className="login-page mkt-auth-center">
      <Panel className="login-card mkt-auth-card">
        <div className="brand login-brand">
          <span className="brand-mark">CF</span>
          <span>Create account</span>
        </div>
        <p className="login-tagline">Strong password required: 8+ chars with upper, lower, and a number.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="small" htmlFor="signup-email">
            Email
          </label>
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <label className="small" htmlFor="signup-username">
            Username
          </label>
          <Input
            id="signup-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={submitting}
            placeholder="paras_dev"
            autoComplete="username"
            required
          />
          <label className="small" htmlFor="signup-password">
            Password
          </label>
          <Input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
          <label className="small" htmlFor="signup-confirm">
            Confirm password
          </label>
          <Input
            id="signup-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={submitting}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
          <Button type="submit" disabled={submitting} className="login-primary-btn">
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="small login-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </Panel>
    </div>
    </AuthLayout>
  );
}
