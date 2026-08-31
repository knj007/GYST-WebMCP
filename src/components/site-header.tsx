import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link className="text-lg font-semibold tracking-tight" href="/">
          GYST
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-5 text-sm text-muted">
          <Link className="transition-colors hover:text-foreground" href="/daily">
            Daily
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/weekly">
            Weekly
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/login">
            Sign in
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/signup">
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}
