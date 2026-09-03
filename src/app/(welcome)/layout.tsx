import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { WelcomeHeader } from "@/components/welcome-header";
import { getCurrentProfile } from "@/lib/auth/session";

/**
 * The first-run shell: wordmark, step indicator, sign-out, and no ritual nav.
 *
 * A demo session is refused here outright; its fictional ledger is already
 * founded. Layouts cannot see the pathname, so the onboarded/not-onboarded
 * decision belongs to each page through `requireWelcomeStage`.
 */
export default async function WelcomeLayout({ children }: { children: ReactNode }) {
  const { identity, profile } = await getCurrentProfile();

  if (identity.isDemo) {
    redirect("/daily");
  }

  const displayName = profile?.display_name ?? identity.email ?? "Signed in";

  return (
    <div className="min-h-screen">
      <WelcomeHeader displayName={displayName} />
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
    </div>
  );
}
