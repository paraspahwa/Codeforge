"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Button, Panel } from "@codeforge/ui";

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
    <div className="onboarding-page">
      <Panel className="onboarding-card">
        <h1>Welcome to CodeForge</h1>
        <p className="small">Pick how you want to start — you can change this later in Settings.</p>
        <div className="onboarding-actions">
          <Button type="button" onClick={() => choose("founder")}>
            I have an idea (founder)
          </Button>
          <Button type="button" variant="ghost" onClick={() => choose("developer")}>
            I write code (developer)
          </Button>
        </div>
        <p className="small">
          <Link href="/app">Skip for now</Link>
        </p>
      </Panel>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="onboarding-page minimal-shell">Loading…</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
