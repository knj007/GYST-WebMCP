import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site-header";

export default function RitualLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
    </div>
  );
}
