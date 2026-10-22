import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Affiliate Commerce OS",
  description: "Product discovery, faceless content, approvals, and affiliate performance in one dashboard.",
  appleWebApp: { capable: true, title: "Mallory", statusBarStyle: "default" },
  icons: { apple: "/api/pwa-icon?s=180" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c2410c"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
