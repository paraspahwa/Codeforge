"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../../lib/auth-context";
import { useToast } from "../../../lib/toast-context";

export default function OidcCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOidcLogin } = useAuth();
  const toast = useToast();
  const [message, setMessage] = useState("Completing sign-in…");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      const detail = errorDescription ? `${error}: ${errorDescription}` : error;
      setFailed(true);
      setMessage(`Sign-in failed: ${detail}`);
      toast.push(`OIDC sign-in failed: ${detail}`);
      return;
    }

    if (!code || !state) {
      setFailed(true);
      setMessage("Missing authorization code or state. Start again from the login page.");
      return;
    }

    completeOidcLogin(code, state)
      .then(() => {
        toast.push("Signed in with SSO", "success");
        router.replace("/");
      })
      .catch((callbackError) => {
        setFailed(true);
        setMessage(callbackError.message);
        toast.push(callbackError.message);
      });
  }, [completeOidcLogin, router, searchParams, toast]);

  return (
    <div className="login-page">
      <section className="panel login-card">
        <div className="brand login-brand">
          <span className="brand-mark">CF</span>
          <span>CodeForge</span>
        </div>
        <h2>{failed ? "Sign-in issue" : "Signing in"}</h2>
        <p className="small login-tagline">{message}</p>
        {failed ? (
          <p className="small mt-6">
            <Link href="/login">Back to login</Link>
            {" · "}
            <Link href="/settings">Check SSO settings</Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
