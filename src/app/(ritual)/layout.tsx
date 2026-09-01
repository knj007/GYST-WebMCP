import type { ReactNode } from "react";

import { AuthenticatedHeader } from "@/components/authenticated-header";
import { DemoBanner } from "@/components/demo-banner";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function RitualLayout({ children }: { children: ReactNode }) {
  const { identity, profile } = await getCurrentProfile();
  const displayName = profile?.display_name ?? identity.email ?? "Signed in";

  return (
    <div className="min-h-screen">
      {identity.isDemo ? <DemoBanner /> : null}
      <AuthenticatedHeader displayName={displayName} />
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
    </div>
  );
}
