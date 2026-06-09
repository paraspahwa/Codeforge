"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "../../../lib/auth-context";
import { useToast } from "../../../lib/toast-context";

export default function OidcCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOidcLogin } = useAuth();
  const toast = useToast();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setMessage(`Sign-in failed: ${error}`);
      toast.push(`OIDC sign-in failed: ${error}`);
      return;
    }

    if (!code || !state) {
      setMessage("Missing authorization code or state.");
      return;
    }

    completeOidcLogin(code, state)
      .then(() => {
        toast.push("Signed in with SSO", "success");
        router.replace("/");
      })
      .catch((callbackError) => {
        setMessage(callbackError.message);
        toast.push(callbackError.message);
      });
  }, [completeOidcLogin, router, searchParams, toast]);

  return (
    <section className="panel empty-state">
      <h2>Signing in</h2>
      <p className="small">{message}</p>
    </section>
  );
}
