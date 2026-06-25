"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@codeforge/ui";

import { useAuth } from "../../lib/auth-context";
import { useShellBar } from "../../lib/shell-context";
import LandingContainer from "./LandingContainer";

const NAV_LINKS = [
  { href: "/#capabilities", label: "Platform", anchor: "capabilities", match: null },
  { href: "/editor", label: "Editor", anchor: null, match: "/editor" },
  { href: "/agents", label: "Agents", anchor: null, match: "/agents" },
  { href: "/features", label: "Features", anchor: null, match: "/features" },
  { href: "/pricing", label: "Pricing", anchor: null, match: "/pricing" },
  { href: "/roadmap", label: "Roadmap", anchor: null, match: "/roadmap" },
];

const ACCOUNT_NAV = [
  { href: "/app", label: "Workspace" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
  { href: "/team", label: "Team" },
  { href: "/analytics", label: "Usage" },
];

const ACCOUNT_AUTH_REQUIRED = ["/settings", "/team", "/analytics"];

export default function MarketingShell({ children, variant = "default" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, ready, username, userId, logout } = useAuth();
  const { usage } = useShellBar();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = variant === "landing";
  const isAccount = variant === "account";

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAccount || !ready) {
      return;
    }
    const needsAuth = ACCOUNT_AUTH_REQUIRED.some(
      (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`),
    );
    if (needsAuth && !token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAccount, ready, token, pathname, router]);

  function scrollToAnchor(event, anchorId) {
    if (!anchorId) {
      return;
    }
    if (pathname === "/") {
      event.preventDefault();
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function isActive(item) {
    if (item.match) {
      return pathname === item.match || pathname?.startsWith(`${item.match}/`);
    }
    return false;
  }

  function isAccountNavActive(href) {
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <div
      className={`marketing-shell ${isLanding ? "marketing-shell--landing" : ""} ${isAccount ? "marketing-shell--account" : ""} mkt-shell landing-mesh-bg`}
    >
      <header className={`marketing-header mkt-header ${scrolled ? "marketing-header--scrolled mkt-header--scrolled" : ""}`}>
        <LandingContainer wide className="marketing-header-inner mkt-header-inner">
          <Link href="/" className="brand marketing-brand mkt-brand">
            <span className="brand-mark mkt-brand-mark">CF</span>
            <span>CodeForge</span>
          </Link>

          <nav className="marketing-nav mkt-nav" aria-label="Marketing">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`marketing-nav-link mkt-nav-link ${isActive(item) ? "marketing-nav-link-active mkt-nav-link-active" : ""}`}
                onClick={item.anchor ? (event) => scrollToAnchor(event, item.anchor) : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="marketing-header-actions mkt-header-actions">
            {isAccount && token ? (
              <>
                {usage ? (
                  <span className="mkt-usage-pill small">
                    {usage.requests_remaining ?? 0} req left
                  </span>
                ) : null}
                <span className="mkt-user-label small">{username || userId}</span>
                <button type="button" className="mkt-signout-btn" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="marketing-signin mkt-signin">
                  Sign in
                </Link>
                <Link href="/editor" className="marketing-cta-btn mkt-cta-btn">
                  Open editor
                </Link>
              </>
            )}
            <button
              type="button"
              className="marketing-nav-toggle mkt-nav-toggle"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              <Icon name={mobileOpen ? "X" : "Menu"} size={20} />
              <span className="sr-only">{mobileOpen ? "Close" : "Menu"}</span>
            </button>
          </div>
        </LandingContainer>

        {isAccount ? (
          <nav className="mkt-account-nav" aria-label="Account">
            <LandingContainer wide className="mkt-account-nav-inner">
              {ACCOUNT_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mkt-account-nav-link ${isAccountNavActive(item.href) ? "is-active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </LandingContainer>
          </nav>
        ) : null}

        <nav
          className={`marketing-mobile-nav mkt-mobile-nav ${mobileOpen ? "is-open" : ""}`}
          aria-label="Mobile marketing"
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              onClick={item.anchor ? (event) => scrollToAnchor(event, item.anchor) : undefined}
            >
              {item.label}
            </Link>
          ))}
          {isAccount
            ? ACCOUNT_NAV.map((item) => (
                <Link key={`mobile-acct-${item.href}`} href={item.href}>
                  {item.label}
                </Link>
              ))
            : null}
          {!token ? (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/editor" className="mkt-mobile-cta">
                Open editor
              </Link>
            </>
          ) : (
            <button type="button" className="mkt-mobile-signout" onClick={logout}>
              Sign out
            </button>
          )}
        </nav>
      </header>

      <main
        id="main-content"
        className={`marketing-main mkt-main ${isLanding ? "marketing-main--wide" : ""} ${isAccount ? "mkt-main--account" : ""}`}
      >
        {children}
      </main>

      <footer className="marketing-footer mkt-footer">
        <LandingContainer>
          <div className="marketing-footer-grid mkt-footer-grid">
            <div>
              <p className="brand marketing-brand mkt-brand">
                <span className="brand-mark mkt-brand-mark">CF</span>
                <span>CodeForge</span>
              </p>
              <p className="small marketing-footer-tagline mkt-footer-tagline">
                AI coding agent with Monaco IDE, composer, and verify loops.
              </p>
            </div>
            <div>
              <p className="marketing-footer-label mkt-footer-label">Product</p>
              <Link href="/editor">Web editor</Link>
              <Link href="/agents">Agents</Link>
              <Link href="/features">Features</Link>
              <Link href="/pricing">Pricing</Link>
            </div>
            <div>
              <p className="marketing-footer-label mkt-footer-label">Company</p>
              <Link href="/about">About</Link>
              <Link href="/roadmap">Roadmap</Link>
              <Link href="/case-studies">Stories</Link>
              <a href="mailto:hello@codeforge.app">Contact</a>
            </div>
            <div>
              <p className="marketing-footer-label mkt-footer-label">Legal</p>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
          <p className="small marketing-footer-copy mkt-footer-copy">
            © {new Date().getFullYear()} CodeForge. Built for developers who ship with agents.
          </p>
        </LandingContainer>
      </footer>
    </div>
  );
}
