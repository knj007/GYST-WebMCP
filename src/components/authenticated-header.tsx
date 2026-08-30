import Link from "next/link";

import { signOut } from "@/lib/auth/actions";

export function AuthenticatedHeader({ displayName }: { displayName: string }) {
  return (
    <header className="border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link className="text-lg font-semibold tracking-tight" href="/daily">
          GYST
        </Link>
        <nav aria-label="Ritual" className="flex items-center gap-5 text-sm text-muted">
          <Link className="transition-colors hover:text-foreground" href="/daily">
            Daily
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/weekly">
            Weekly
          </Link>
          <span className="hidden text-foreground sm:inline">{displayName}</span>
          <form action={signOut}>
            <button className="transition-colors hover:text-foreground" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
