import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FTC Field Lab · BIOBUZZ",
  description: "A 3D BIOBUZZ field and FTC robot programming workspace with live motor and sensor simulation.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
