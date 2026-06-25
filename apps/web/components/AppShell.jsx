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
  const { userId, username, token, ready, logout } = useAuth();
  const { usage, sessionGrant } = useShellBar();
  const [navOpen, setNavOpen] = useState(false);
  const [journeyDone, setJourneyDone] = useState(0);
  const [navPinned, setNavPinned] = useState(false);

  const isChatRoute = pathname === "/app" || pathname?.startsWith("/app/");
  const isIdeRoute = pathname === "/code" || pathname?.startsWith("/code/");
  const isImmersiveRoute = isChatRoute || isIdeRoute;

  useEffect(() => {
    try {
      setNavPinned(window.localStorage.getItem("codeforge_nav_pinned") === "true");
    } catch {
      setNavPinned(false);
    }
  }, []);

  function toggleNavPinned() {
    setNavPinned((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("codeforge_nav_pinned", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

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
        {isChatRoute ? (
          <button
            type="button"
            className="sidebar-pin-btn"
            onClick={toggleNavPinned}
            title={navPinned ? "Collapse navigation" : "Expand navigation"}
            aria-label={navPinned ? "Collapse navigation" : "Expand navigation"}
          >
            <Icon name={navPinned ? "PinOff" : "Pin"} size={18} />
            <span className="sidebar-pin-label">{navPinned ? "Collapse nav" : "Pin nav"}</span>
          </button>
        ) : (
          "Your AI product partner"
        )}
      </div>
    </aside>
  );

  const shellClass = [
    "app-shell",
    isIdeRoute ? "app-shell-ide" : "",
    isChatRoute ? "app-shell-chat" : "",
    isChatRoute && navPinned ? "app-shell-chat-pinned" : "",
    isImmersiveRoute ? "app-shell-immersive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      {!isIdeRoute ? (
        <>
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
        </>
      ) : null}
      <div className={`content-area ${isIdeRoute ? "content-area-ide" : ""}`}>
        {!isIdeRoute ? (
        <header className={`topbar ${isImmersiveRoute ? "topbar-immersive" : ""}`}>
          <Suspense fallback={null}>
            <SessionChrome />
          </Suspense>
          {token ? (
            <div className="topbar-session">
              {usage ? (
                <span className="usage-pill" title="Requests remaining this month">
                  {usage.requests_remaining ?? 0} left
                </span>
              ) : null}
              {sessionGrant?.viewOnly ? <Badge variant="warning">View-only</Badge> : null}
              <span className="small topbar-username" title={username || userId}>
                {username || userId}
              </span>
              <button type="button" className="cf-icon-btn cf-icon-btn-ghost" onClick={logout} title="Sign out">
                <Icon name="LogOut" size={14} />
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="nav-link nav-link-active inline-btn">
              Sign in
            </Link>
          )}
        </header>
        ) : null}
        <main id="main-content" className={`page ${isIdeRoute ? "page-ide" : ""} ${isChatRoute ? "page-chat" : ""}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
