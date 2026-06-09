import "./globals.css";

import AppShell from "../components/AppShell";
import { AuthProvider } from "../lib/auth-context";
import { ToastProvider } from "../lib/toast-context";

export const metadata = {
  title: "CodeForge Web",
  description: "CodeForge web dashboard and chat interface",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
