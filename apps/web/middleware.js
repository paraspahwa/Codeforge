import { NextResponse } from "next/server";

const SESSION_COOKIE = "codeforge_session";

const PUBLIC_PREFIXES = ["/login", "/signup", "/auth", "/pricing", "/privacy", "/terms", "/about", "/billing", "/roadmap", "/case-studies"];

const PROTECTED_PREFIXES = [
  "/app",
  "/agents",
  "/features",
  "/extensions",
  "/mcp",
  "/code",
  "/sessions",
  "/cowork",
  "/team",
  "/analytics",
  "/settings",
];

function isPublicPath(pathname) {
  if (pathname === "/") {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/share") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
