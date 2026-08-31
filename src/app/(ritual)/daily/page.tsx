import { DailyRitualForm } from "@/components/daily-ritual-form";
import { getDailyRitual } from "@/lib/rituals/daily";

export default async function DailyPage() {
  const { commitments, entry, periodStart, profile, session } = await getDailyRitual();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Daily ritual</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        Close the day with intention{profile?.display_name ? `, ${profile.display_name}` : ""}.
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        {session
          ? `Your ${session.status} daily record is for ${session.period_start}.`
          : `Start the daily draft for ${periodStart}.`}
      </p>
      <DailyRitualForm commitments={commitments} entry={entry} periodStart={periodStart} session={session} />
    </section>
  );
}
