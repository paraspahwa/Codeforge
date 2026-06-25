import Link from "next/link";

export default function AuthLayout({ children }) {
  return (
    <div className="mkt-auth-page">
      <header className="mkt-auth-header">
        <Link href="/" className="brand mkt-brand">
          <span className="brand-mark mkt-brand-mark">CF</span>
          <span>CodeForge</span>
        </Link>
        <nav className="mkt-auth-header-links" aria-label="Auth navigation">
          <Link href="/editor">Editor</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
      </header>
      <div className="mkt-auth-body">{children}</div>
    </div>
  );
}
