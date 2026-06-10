"use client";

import { usePathname } from "next/navigation";

import AppShell from "./AppShell";

function isMinimalRoute(pathname) {
  if (!pathname) {
    return false;
  }
  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    return true;
  }
  return pathname.startsWith("/share/");
}

export default function ShellRouter({ children }) {
  const pathname = usePathname();
  if (isMinimalRoute(pathname)) {
    return <div className="minimal-shell">{children}</div>;
  }
  return <AppShell>{children}</AppShell>;
}
