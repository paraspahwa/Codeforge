"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Badge, Icon, NavItem } from "@codeforge/ui";

import { useAuth } from "../lib/auth-context";
import { useShellBar } from "../lib/shell-context";
import { getBuildJourneyState, JOURNEY_STEPS } from "../lib/build-journey";
import SessionChrome from "./SessionChrome";

const NAV_SECTIONS = [
  {
    title: "Build",
    items: [
      { href: "/app", label: "AI partner", icon: "MessageSquare", hint: "Describe your app idea" },
      { href: "/agents", label: "Agents", icon: "Bot", hint: "30+ agent patterns" },
      { href: "/features", label: "Features", icon: "Sparkles", hint: "All tools" },
      { href: "/extensions", label: "Extensions", icon: "Plug", hint: "LSP & plugins" },
      { href: "/mcp", label: "MCP servers", icon: "Globe", hint: "Model Context Protocol" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/cowork", label: "Automations", icon: "Handshake", hint: "Files & workflows" },
      { href: "/sessions", label: "My chats", icon: "FolderOpen", hint: "Past conversations" },
      { href: "/code", label: "Code editor", icon: "Keyboard", hint: "Full IDE editing" },
    ],
  },
  {
    title: "Team & account",
    items: [
      { href: "/team", label: "Team", icon: "Users", hint: "Collaborate" },
      { href: "/analytics", label: "Usage", icon: "BarChart3", hint: "Activity" },
      { href: "/billing", label: "Billing", icon: "CreditCard", hint: "Plans" },
      { href: "/settings", label: "Settings", icon: "Settings", hint: "Preferences" },
    ],
  },
];

const PROTECTED_PREFIXES = ["/app", "/agents", "/features", "/extensions", "/mcp", "/code", "/sessions", "/cowork", "/team", "/analytics", "/settings"];

function isProtectedRoute(pathname) {
  if (pathname === "/billing") {
    return false;
  }
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isNavActive(pathname, href) {
  if (href === "/app") {
    return pathname === "/app" || pathname.startsWith("/app/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, token, ready, logout } = useAuth();
  const { usage, sessionGrant } = useShellBar();
  const [navOpen, setNavOpen] = useState(false);
  const [journeyDone, setJourneyDone] = useState(0);

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

  useEffect(() => {
    const state = getBuildJourneyState();
    setJourneyDone(state.completed?.length ?? 0);
  }, [pathname]);

  const sidebar = (
    <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
      <div className="brand cf-animate-in">
        <span className="brand-mark cf-bounce-gentle">CF</span>
        <span>CodeForge</span>
      </div>
      {journeyDone > 0 ? (
        <div className="sidebar-journey small" aria-label="Build journey progress">
          <span>
            Journey {journeyDone}/{JOURNEY_STEPS.length}
          </span>
          <div className="sidebar-journey-bar" role="progressbar" aria-valuenow={journeyDone} aria-valuemin={0} aria-valuemax={JOURNEY_STEPS.length}>
            <span style={{ width: `${(journeyDone / JOURNEY_STEPS.length) * 100}%` }} />
          </div>
        </div>
      ) : null}
      <nav className="sidebar-nav-full" aria-label="Main">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.title} className="nav-section cf-animate-in" style={{ animationDelay: `${sectionIndex * 60}ms` }}>
            <p className="nav-section-label small">{section.title}</p>
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                Component={Link}
                href={item.href}
                label={item.label}
                hint={item.hint}
                icon={item.icon}
                active={isNavActive(pathname, item.href)}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer small cf-animate-in" style={{ animationDelay: "200ms" }}>
        Your AI product partner
      </div>
    </aside>
  );

  const isIdeRoute = pathname === "/code" || pathname.startsWith("/code/");

  return (
    <div className={`app-shell ${isIdeRoute ? "app-shell-ide" : ""}`}>
      <button
        type="button"
        className="nav-toggle"
        aria-label="Toggle navigation"
        aria-expanded={navOpen}
        onClick={() => setNavOpen((open) => !open)}
      >
        <Icon name="Menu" size={22} />
      </button>
      {navOpen ? (
        <button type="button" className="nav-overlay" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
      ) : null}
      {sidebar}
      <div className="content-area">
        <header className="topbar">
          <Suspense fallback={null}>
            <SessionChrome />
          </Suspense>
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
        <main id="main-content" className={`page ${isIdeRoute ? "page-ide" : ""}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
