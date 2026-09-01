import { DailyRitualForm } from "@/components/daily-ritual-form";
import { WebMcpTools } from "@/components/webmcp-tools";
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
      {session?.status !== "committed" ? <aside className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-5" aria-label="Daily check-in prompt"><p className="font-semibold">Ready for today’s check-in?</p><p className="mt-1 text-sm leading-6 text-muted">Start with what moved today, name anything that got in the way, then choose the one commitment to carry into tomorrow.</p></aside> : null}
      {session?.status !== "committed" ? <WebMcpTools periodStart={periodStart} ritual="daily" /> : null}
      <DailyRitualForm key={session?.version ?? "new-daily-draft"} commitments={commitments} entry={entry} periodStart={periodStart} session={session} />
    </section>
  );
}
