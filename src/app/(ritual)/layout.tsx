import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AuthenticatedHeader } from "@/components/authenticated-header";
import { DemoBanner } from "@/components/demo-banner";
import { getCurrentProfile } from "@/lib/auth/session";
import { needsOnboarding } from "@/lib/onboarding/gate";

export default async function RitualLayout({ children }: { children: ReactNode }) {
  const { identity, profile } = await getCurrentProfile();

  // A new owner has nothing to score and nothing to choose until the founding
  // commit; the welcome pages repair that before any ritual is attempted.
  if (needsOnboarding({ isDemo: identity.isDemo, profile })) {
    redirect("/welcome");
  }

  const displayName = profile?.display_name ?? identity.email ?? "Signed in";

  return (
    <div className="min-h-screen">
      {identity.isDemo ? <DemoBanner /> : null}
      <AuthenticatedHeader displayName={displayName} />
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
    </div>
  );
}
