import { getRitualLanding } from "@/lib/rituals/landing";

export default async function WeeklyPage() {
  const { session } = await getRitualLanding("weekly");

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Weekly ritual</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Read before you ask.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        {session
          ? `Your latest ${session.status} weekly record begins ${session.period_start}.`
          : "No weekly record exists yet. Your first bounded review will begin here."}
      </p>
      <p className="mt-6 text-sm text-muted">
        Initial context is read on the server after claim validation; Proxy redirects are only a convenience layer.
      </p>
    </section>
  );
}
