import Link from "next/link";

import { DemoEntryButton } from "@/components/demo-entry-button";
import { isDemoConfigured } from "@/lib/demo/session";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  const demoSiteKey = isDemoConfigured()
    ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
    : undefined;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-28">
        <section>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Get your stuff together
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
            A quiet ledger for the work only you can decide.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted">
            Read the week, conduct the ritual, and prepare the record. The agent can help with the draft. Only you can commit it.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="rounded-full bg-accent px-6 py-3 font-medium text-white" href="/daily">
              Start the daily ritual
            </Link>
            <Link className="rounded-full border border-line bg-surface px-6 py-3 font-medium" href="/weekly">
              Review the week
            </Link>
          </div>
          {demoSiteKey ? (
            <div className="mt-12 max-w-md rounded-[1.5rem] border border-line bg-surface p-6">
              <h2 className="text-lg font-semibold tracking-tight">Look around first</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Open a private demo with a fictional ledger already in it — a week of history, its
                patterns, and an open ritual to conduct. No account, no email, nothing to remember.
              </p>
              <div className="mt-5">
                <DemoEntryButton siteKey={demoSiteKey} />
              </div>
            </div>
          ) : null}
        </section>
        <aside className="rounded-[2rem] border border-line bg-surface p-8 shadow-[0_24px_70px_rgba(28,40,34,0.08)]">
          <p className="text-sm font-medium text-muted">The ownership boundary</p>
          <ol className="mt-6 space-y-5">
            <li><span className="font-semibold text-accent">01</span><p className="mt-1">The ledger supplies bounded context.</p></li>
            <li><span className="font-semibold text-accent">02</span><p className="mt-1">You and the agent prepare a visible draft.</p></li>
            <li><span className="font-semibold text-accent">03</span><p className="mt-1">A human action commits the final record.</p></li>
          </ol>
        </aside>
      </main>
    </div>
  );
}
