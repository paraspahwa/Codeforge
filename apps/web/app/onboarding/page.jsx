"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Button, Panel } from "@codeforge/ui";

import AuthLayout from "../../components/marketing/AuthLayout";
import { audienceHomePath, setAudiencePreference } from "../../lib/audience-preference";

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  function choose(audience) {
    setAudiencePreference(audience);
    if (nextPath?.startsWith("/") && nextPath !== "/onboarding") {
      router.replace(nextPath);
      return;
    }
    router.replace(audienceHomePath(audience));
  }

  return (
    <AuthLayout>
    <div className="onboarding-page mkt-auth-center">
      <Panel className="onboarding-card mkt-auth-card">
        <div className="brand login-brand mkt-brand">
          <span className="brand-mark mkt-brand-mark">CF</span>
          <span>Welcome</span>
        </div>
        <h1 className="mkt-auth-title">How will you use CodeForge?</h1>
        <p className="small mkt-auth-tagline">Pick a starting point — you can change this later in Settings.</p>
        <div className="onboarding-actions">
          <Button type="button" onClick={() => choose("founder")}>
            I have an idea (founder)
          </Button>
          <Button type="button" variant="ghost" onClick={() => choose("developer")}>
            I write code (developer)
          </Button>
        </div>
        <p className="small login-footer">
          <Link href="/editor">Try editor without signing in</Link>
          {" · "}
          <Link href="/app">Skip for now</Link>
        </p>
      </Panel>
    </div>
    </AuthLayout>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="onboarding-page minimal-shell">Loading…</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
