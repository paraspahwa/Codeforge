"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@codeforge/ui";

import { useAuth } from "../lib/auth-context";
import { useShellBar } from "../lib/shell-context";

const NAV_GROUPS = [
  {
    label: "Build",
    items: [
      { href: "/", label: "Chat" },
      { href: "/sessions", label: "Sessions" },
    ],
  },
  {
    label: "Automate",
    items: [{ href: "/cowork", label: "Cowork" }],
  },
  {
    label: "Team",
    items: [{ href: "/team", label: "Team" }],
  },
  {
    label: "Account",
    items: [
      { href: "/analytics", label: "Analytics" },
      { href: "/billing", label: "Billing" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

const PROTECTED_PREFIXES = ["/", "/sessions", "/cowork", "/team", "/analytics", "/settings"];

function isProtectedRoute(pathname) {
  if (pathname === "/billing") {
    return false;
  }
  return PROTECTED_PREFIXES.some((prefix) =>
    prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, token, ready, logout } = useAuth();
  const { usage, sessionGrant } = useShellBar();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!token && isProtectedRoute(pathname)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [ready, token, pathname, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const sidebar = (
    <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
      <div className="brand">
        <span className="brand-mark">CF</span>
        <span>CodeForge</span>
      </div>
      <nav>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="nav-group">
            <p className="nav-group-label small">{group.label}</p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${pathname === item.href ? "nav-link-active" : ""}`}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer small">India-first AI coding assistant</div>
    </aside>
  );

  return (
    <div className="app-shell">
      <button
        type="button"
        className="nav-toggle"
        aria-label="Toggle navigation"
        onClick={() => setNavOpen((open) => !open)}
      >
        ☰
      </button>
      {navOpen ? (
        <button type="button" className="nav-overlay" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
      ) : null}
      {sidebar}
      <div className="content-area">
        <header className="topbar">
          {token ? (
            <div className="topbar-session">
              {usage ? (
                <span className="usage-pill small">
                  {usage.requests_remaining ?? 0} requests left
                </span>
              ) : null}
              {sessionGrant?.viewOnly ? <Badge variant="warning">View-only session</Badge> : null}
              <Badge variant="primary">Signed in</Badge>
              <span className="small">
                <strong>{userId}</strong>
              </span>
              <button type="button" className="ghost-btn inline-btn" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <Link href="/login" className="nav-link nav-link-active inline-btn">
              Sign in
            </Link>
          )}
        </header>
        <main id="main-content" className="page">
          {children}
        </main>
      </div>
    </div>
  );
}
