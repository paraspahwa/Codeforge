import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";

import ShellRouter from "../components/ShellRouter";
import { AuthProvider } from "../lib/auth-context";
import { ShellProvider } from "../lib/shell-context";
import { StackStatusProvider } from "../lib/stack-status-context";
import { ToastProvider } from "../lib/toast-context";

import "./globals.css";
import "./marketing.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

function resolveMetadataBase() {
  const webBase = process.env.CODEFORGE_WEB_BASE_URL?.trim();
  if (webBase) {
    try {
      return new URL(webBase);
    } catch {
      // ignore invalid env value
    }
  }
  const apiBase = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (apiBase) {
    try {
      return new URL(apiBase.replace(/:8000\/?$/, ":3000"));
    } catch {
      // ignore invalid env value
    }
  }
  return undefined;
}

export const metadata = {
  metadataBase: resolveMetadataBase(),
  title: "CodeForge",
  description: "India-first AI coding assistant — chat, code, cowork, and team workflows.",
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CodeForge",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "CodeForge",
    description: "India-first AI coding assistant — chat, code, cowork, and team workflows.",
    type: "website",
    images: [{ url: "/icon.svg", width: 64, height: 64, alt: "CodeForge" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#09090b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <ToastProvider>
          <StackStatusProvider>
            <AuthProvider>
              <ShellProvider>
                <ShellRouter>{children}</ShellRouter>
              </ShellProvider>
            </AuthProvider>
          </StackStatusProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
