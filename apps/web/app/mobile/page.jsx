"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../lib/auth-context";

/** Mobile companion — PWA-optimized entry to chat */
export default function MobileCompanionPage() {
  const router = useRouter();
  const { ready, token } = useAuth();

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!token) {
      router.replace("/login?next=/mobile");
      return;
    }
    router.replace("/app");
  }, [ready, token, router]);

  return (
    <div className="mobile-companion-shell">
      <p className="small muted">Opening CodeForge mobile chat…</p>
      <p className="small">
        Install this app from your browser menu for a full-screen companion experience.
      </p>
    </div>
  );
}
