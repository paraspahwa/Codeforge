import { Inter, JetBrains_Mono } from "next/font/google";

import ShellRouter from "../components/ShellRouter";
import { AuthProvider } from "../lib/auth-context";
import { ShellProvider } from "../lib/shell-context";
import { ToastProvider } from "../lib/toast-context";

import "./globals.css";

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

export const metadata = {
  title: "CodeForge",
  description: "India-first AI coding assistant — chat, code, cowork, and team workflows.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "CodeForge",
    description: "India-first AI coding assistant — chat, code, cowork, and team workflows.",
    type: "website",
    images: [{ url: "/icon.svg", width: 64, height: 64, alt: "CodeForge" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <ToastProvider>
          <AuthProvider>
            <ShellProvider>
              <ShellRouter>{children}</ShellRouter>
            </ShellProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
