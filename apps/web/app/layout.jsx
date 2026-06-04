import "./globals.css";

export const metadata = {
  title: "CodeForge Web",
  description: "CodeForge web dashboard and chat interface",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
