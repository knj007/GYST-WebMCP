import Link from "next/link";

import { requireWelcomeStage } from "@/lib/onboarding/access";

export default async function WelcomePage() {
  const { identity, profile } = await requireWelcomeStage("orientation");
  const name = profile?.display_name ?? identity.email;

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Welcome</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Found your ledger{name ? `, ${name}` : ""}.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        GYST is a private ledger of what you decided and what you did about it. Two short rituals feed it: a daily close and a weekly read. Before the first one can happen, the ledger needs to know what you are working toward.
      </p>

      <div className="mt-8 grid gap-6">
        <section className="rounded-2xl border border-line bg-background p-6">
          <h2 className="text-xl font-semibold">What the ledger is</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            A set of areas, the goals inside them, the dates that matter, and the commitments you make toward those goals. Each daily ritual scores the last commitment and chooses the next. Each weekly ritual reads the week and turns it into a decision. Committed records are immutable; you can always see what you said and when.
          </p>
        </section>
        <section className="rounded-2xl border border-line bg-background p-6">
          <h2 className="text-xl font-semibold">What an agent may and may not do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            <li>It may read your current week and your drafts through the browser’s WebMCP tools.</li>
            <li>It may prepare drafts in your own words and mark every field it touched so you can review it.</li>
            <li>It may never commit, delete, export, or read your history. Committing is a button only you can press.</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-line bg-background p-6">
          <h2 className="text-xl font-semibold">What committing means</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Saving keeps a draft you can keep editing. Committing writes a dated, immutable record in one transaction. On the next page you draft your areas, goals, key dates, and first commitments, by hand or with an agent’s help; on the page after that you commit them as your founding statement.
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Link className="inline-block rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white" href="/welcome/goals">
          Set your goals
        </Link>
      </div>
    </section>
  );
}
