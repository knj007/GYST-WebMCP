import { getRitualLanding } from "@/lib/rituals/landing";

export default async function DailyPage() {
  const { profile, session } = await getRitualLanding("daily");

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Daily ritual</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        Close the day with intention{profile?.display_name ? `, ${profile.display_name}` : ""}.
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        {session
          ? `Your latest ${session.status} daily record is for ${session.period_start}.`
          : "No daily record exists yet. The first six-beat draft will begin here."}
      </p>
      <p className="mt-6 text-sm text-muted">
        The server verified this session and loaded only your RLS-scoped ledger rows.
      </p>
    </section>
  );
}
