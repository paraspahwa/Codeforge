"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@codeforge/ui";

import { useAuth } from "../lib/auth-context";
import { useShellBar } from "../lib/shell-context";

const NAV_SECTIONS = [
  {
    title: "Build",
    items: [
      { href: "/", label: "AI partner", icon: "💬", hint: "Describe your app idea" },
      { href: "/agents", label: "Agents", icon: "🤖", hint: "30+ agent patterns" },
      { href: "/features", label: "Features", icon: "✨", hint: "All tools" },
      { href: "/extensions", label: "Extensions", icon: "🔌", hint: "LSP & plugins" },
      { href: "/mcp", label: "MCP servers", icon: "🌐", hint: "Model Context Protocol" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/cowork", label: "Automations", icon: "🤝", hint: "Files & workflows" },
      { href: "/sessions", label: "My chats", icon: "🗂️", hint: "Past conversations" },
      { href: "/code", label: "Code editor", icon: "⌨️", hint: "Full IDE editing" },
    ],
  },
  {
    title: "Team & account",
    items: [
      { href: "/team", label: "Team", icon: "👥", hint: "Collaborate" },
      { href: "/analytics", label: "Usage", icon: "📊", hint: "Activity" },
      { href: "/billing", label: "Billing", icon: "💳", hint: "Plans" },
      { href: "/settings", label: "Settings", icon: "⚙️", hint: "Preferences" },
    ],
  },
];

const PROTECTED_PREFIXES = ["/", "/agents", "/features", "/extensions", "/mcp", "/code", "/sessions", "/cowork", "/team", "/analytics", "/settings"];

function isProtectedRoute(pathname) {
  if (pathname === "/billing") {
    return false;
  }
  return PROTECTED_PREFIXES.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
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
    const isProtected = isProtectedRoute(pathname);
    if (!token && isProtected) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [ready, token, pathname, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const sidebar = (
    <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
      <div className="brand cf-animate-in">
        <span className="brand-mark cf-bounce-gentle">CF</span>
        <span>CodeForge</span>
      </div>
      <nav className="sidebar-nav-full">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.title} className="nav-section cf-animate-in" style={{ animationDelay: `${sectionIndex * 60}ms` }}>
            <p className="nav-section-label small">{section.title}</p>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link nav-link-feature ${pathname === item.href ? "nav-link-active" : ""}`}
                aria-current={pathname === item.href ? "page" : undefined}
                title={item.hint}
              >
                <span className="nav-link-icon cf-wiggle-hover" aria-hidden>
                  {item.icon}
                </span>
                <span className="nav-link-text">
                  <span className="nav-link-label">{item.label}</span>
                  <span className="nav-link-hint small">{item.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer small cf-animate-in" style={{ animationDelay: "200ms" }}>
        <span className="cf-sparkle-inline" aria-hidden>✦</span> Your AI product partner
      </div>
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
                <span className="usage-pill small cf-pulse-soft">
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
