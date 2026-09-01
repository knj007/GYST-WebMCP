import { AccountOwnershipPanel } from "@/components/account-ownership-panel";
import { requireUser } from "@/lib/auth/session";

export default async function AccountSettingsPage() {
  const identity = await requireUser();
  if (identity.isDemo) {
    return <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Your data</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">The demo is temporary.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">Demo records are fictional and unrecoverable. Create a permanent account to export and manage your own ledger.</p>
    </section>;
  }
  return <AccountOwnershipPanel />;
}
