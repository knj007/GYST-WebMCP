import { AddCommitmentForm } from "@/components/add-commitment-form";
import { WeeklyRitualForm } from "@/components/weekly-ritual-form";
import { WebMcpTools } from "@/components/webmcp-tools";
import { getCurrentProfile } from "@/lib/auth/session";
import { getActiveGoals } from "@/lib/commitments/goals";
import { requireOnboarded } from "@/lib/onboarding/access";
import { getWeeklyRitual, type WeeklyFinding } from "@/lib/rituals/weekly";

function findingText(finding: WeeklyFinding) {
  const detail = finding.detail;
  if (finding.type === "buried_win") return typeof detail.text === "string" ? detail.text : "";
  if (finding.type === "approaching_key_date") return `${String(detail.title)} — due ${String(detail.due_on)}`;
  if (finding.type === "blocker_recurrence") return `${String(detail.blocker_type)} appeared ${String(detail.count)} times`;
  if (finding.type === "repeated_noncompletion") return `${String(detail.title_snapshot)} had ${String(detail.count)} partial, deferred, or not-done outcomes`;
  return `${String(detail.title_snapshot)} was work outside an active top priority`;
}

export default async function WeeklyPage() {
  await requireOnboarded();
  const [ritual, goals, { profile }] = await Promise.all([getWeeklyRitual(), getActiveGoals(), getCurrentProfile()]);

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Weekly ritual</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Read before you ask.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">{ritual.context.week_start} through {ritual.context.week_end} in {ritual.context.timezone}. This context is deliberately bounded to one local week.</p>
      {ritual.session?.status !== "committed" ? <aside className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-5" aria-label="Weekly check-in prompt"><p className="font-semibold">Ready for this week’s check-in?</p><p className="mt-1 text-sm leading-6 text-muted">Read what the week shows, name what is missing, then turn the evidence into a decision and dated priorities.</p></aside> : null}
      <section className="mt-8 rounded-2xl border border-line bg-background p-6" aria-labelledby="weekly-findings">
        <h2 id="weekly-findings" className="text-xl font-semibold">What the week shows</h2>
        {ritual.context.findings.length ? <ul className="mt-4 space-y-3">{ritual.context.findings.map((finding) => <li key={finding.id} className="rounded-xl border border-line p-4"><p className="text-sm font-semibold capitalize">{finding.type.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-muted">{findingText(finding)}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted">No structured patterns appeared in this bounded week.</p>}
      </section>
      {ritual.session?.status !== "committed" ? <WebMcpTools periodStart={ritual.periodStart} ritual="weekly" /> : null}
      <WeeklyRitualForm key={ritual.session?.version ?? "new-weekly-draft"} ritual={ritual} />
      <AddCommitmentForm goals={goals} onboarded={profile?.onboarded_at !== null && profile?.onboarded_at !== undefined} />
    </section>
  );
}
