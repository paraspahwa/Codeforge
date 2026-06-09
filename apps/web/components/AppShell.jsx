"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "../lib/auth-context";
import { useToast } from "../lib/toast-context";

const NAV_ITEMS = [
  { href: "/", label: "Chat" },
  { href: "/sessions", label: "Sessions" },
  { href: "/analytics", label: "Analytics" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { userId, token, login, logout } = useAuth();
  const toast = useToast();
  const [loginInput, setLoginInput] = useState("paras");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    if (!loginInput.trim()) {
      return;
    }
    setLoggingIn(true);
    try {
      await login(loginInput);
      toast.push("Logged in", "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CF</span>
          <span>CodeForge</span>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href ? "nav-link-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer small">India-first AI coding assistant</div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          {token ? (
            <div className="topbar-session">
              <span className="small">
                Signed in as <strong>{userId}</strong>
              </span>
              <button type="button" className="ghost-btn inline-btn" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <form className="topbar-login" onSubmit={handleLogin}>
              <input
                aria-label="Dev user ID"
                placeholder="Dev user ID"
                value={loginInput}
                onChange={(event) => setLoginInput(event.target.value)}
                disabled={loggingIn}
              />
              <button type="submit" disabled={loggingIn || !loginInput.trim()}>
                {loggingIn ? "Logging in..." : "Login"}
              </button>
            </form>
          )}
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
