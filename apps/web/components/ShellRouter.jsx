"use client";

import { usePathname } from "next/navigation";

import AppShell from "./AppShell";

const PUBLIC_MARKETING_PREFIXES = ["/pricing", "/privacy", "/terms", "/about", "/roadmap", "/case-studies"];

function isMarketingRoute(pathname) {
  if (!pathname) {
    return false;
  }
  if (pathname === "/") {
    return true;
  }
  return PUBLIC_MARKETING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isMinimalRoute(pathname) {
  if (!pathname) {
    return false;
  }
  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    return true;
  }
  if (pathname === "/onboarding") {
    return true;
  }
  return pathname.startsWith("/share/");
}

export default function ShellRouter({ children }) {
  const pathname = usePathname();
  if (isMinimalRoute(pathname)) {
    return <div className="minimal-shell">{children}</div>;
  }
  if (isMarketingRoute(pathname)) {
    return children;
  }
  return <AppShell>{children}</AppShell>;
}
