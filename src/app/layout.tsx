import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

import { webMcpSiteToolsScript } from "@/lib/webmcp/site-tools-script";

export const metadata: Metadata = {
  title: "GYST",
  description: "A human-owned daily and weekly ritual ledger.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full"><Script id="gyst-webmcp-site-tools" strategy="beforeInteractive">{webMcpSiteToolsScript}</Script>{children}</body>
    </html>
  );
}
