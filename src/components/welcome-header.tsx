import Link from "next/link";

import { WelcomeSteps } from "@/components/welcome-steps";
import { signOut } from "@/lib/auth/actions";

export function WelcomeHeader({ displayName }: { displayName: string }) {
  return (
    <header className="border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-6 px-6">
        <Link className="text-lg font-semibold tracking-tight" href="/welcome">
          GYST
        </Link>
        <WelcomeSteps />
        <div className="flex items-center gap-5 text-sm text-muted">
          <Link className="transition-colors hover:text-foreground" href="/settings/account">
            Account
          </Link>
          <span className="hidden text-foreground sm:inline">{displayName}</span>
          <form action={signOut}>
            <button className="transition-colors hover:text-foreground" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
