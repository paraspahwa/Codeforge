"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import LandingContainer from "./LandingContainer";

const NAV_LINKS = [
  { href: "/#features", label: "Features", isAnchor: true },
  { href: "/roadmap", label: "Roadmap", isAnchor: false },
  { href: "/case-studies", label: "Case studies", isAnchor: false },
  { href: "/pricing", label: "Pricing", isAnchor: false },
  { href: "/about", label: "About", isAnchor: false },
];

export default function MarketingShell({ children, variant = "default" }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = variant === "landing";

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleFeaturesClick(event) {
    if (pathname === "/") {
      event.preventDefault();
      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className={`marketing-shell ${isLanding ? "marketing-shell--landing" : ""} landing-mesh-bg`}>
      <header className={`marketing-header ${scrolled ? "marketing-header--scrolled" : ""}`}>
        <LandingContainer className="marketing-header-inner landing-glass">
          <Link href="/" className="brand marketing-brand">
            <span className="brand-mark">CF</span>
            <span>CodeForge</span>
          </Link>

          <nav className="marketing-nav" aria-label="Marketing">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`marketing-nav-link ${
                  !item.isAnchor && pathname === item.href ? "marketing-nav-link-active" : ""
                }`}
                onClick={item.isAnchor ? handleFeaturesClick : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="marketing-header-actions">
            <Link href="/login" className="marketing-signin">
              Sign in
            </Link>
            <Link href="/login?next=/app" className="marketing-cta-btn">
              Get started
            </Link>
            <button
              type="button"
              className="marketing-nav-toggle"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </LandingContainer>

        <nav
          className={`marketing-mobile-nav ${mobileOpen ? "is-open" : ""}`}
          aria-label="Mobile marketing"
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              onClick={item.isAnchor ? handleFeaturesClick : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <main id="main-content" className={`marketing-main ${isLanding ? "marketing-main--wide" : ""}`}>
        {children}
      </main>

      <footer className="marketing-footer">
        <LandingContainer>
          <div className="marketing-footer-grid">
            <div>
              <p className="brand marketing-brand">
                <span className="brand-mark">CF</span>
                <span>CodeForge</span>
              </p>
              <p className="small marketing-footer-tagline">India-first AI product partner.</p>
            </div>
            <div>
              <p className="marketing-footer-label">Product</p>
              <Link href="/#features">Features</Link>
              <Link href="/roadmap">Roadmap</Link>
              <Link href="/case-studies">Case studies</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/login?next=/app">Get started</Link>
            </div>
            <div>
              <p className="marketing-footer-label">Resources</p>
              <Link href="/about">About</Link>
              <a href="mailto:hello@codeforge.app">Contact</a>
            </div>
            <div>
              <p className="marketing-footer-label">Legal</p>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
          <p className="small marketing-footer-copy">© {new Date().getFullYear()} CodeForge. All rights reserved.</p>
        </LandingContainer>
      </footer>
    </div>
  );
}
