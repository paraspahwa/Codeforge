"use client";

import { usePathname } from "next/navigation";

import AppShell from "./AppShell";
import MarketingShell from "./marketing/MarketingShell";

const PUBLIC_MARKETING_PREFIXES = [
  "/pricing",
  "/privacy",
  "/terms",
  "/about",
  "/roadmap",
  "/case-studies",
  "/features",
  "/agents",
];

const ACCOUNT_MARKETING_PREFIXES = ["/billing", "/settings", "/team", "/analytics"];

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

function isAccountMarketingRoute(pathname) {
  if (!pathname) {
    return false;
  }
  return ACCOUNT_MARKETING_PREFIXES.some(
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
  if (isAccountMarketingRoute(pathname)) {
    return <MarketingShell variant="account">{children}</MarketingShell>;
  }
  return <AppShell>{children}</AppShell>;
}
