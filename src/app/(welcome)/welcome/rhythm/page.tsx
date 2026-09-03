import Link from "next/link";

import { CopyableText } from "@/components/copyable-text";
import { RitualReminderScheduleForm } from "@/components/ritual-reminder-schedule-form";
import { requireWelcomeStage } from "@/lib/onboarding/access";
import { getRitualReminderSchedules } from "@/lib/reminders/schedule";

const dailySkill = `# GYST daily ritual (agent skill)

When the owner opens /daily in a WebMCP-capable browser:
1. Call gyst.get_daily_context. Use the commitment ids it returns exactly.
2. Ask, in order: What moved today? What got in the way, if anything? How did the previous commitment go (done, partial, deferred, not done, planned skip)? What is the one commitment for tomorrow?
3. Record only what the owner said: gyst.record_moved, gyst.record_blocker, gyst.score_previous_commitment, gyst.set_next_commitment, gyst.record_optional_context.
4. Never invent wording, outcomes, or commitments. Ask instead.
5. Stop before commit. Say: "The draft is ready for your review. Only you can commit today."`;

const weeklySkill = `# GYST weekly ritual (agent skill)

When the owner opens /weekly in a WebMCP-capable browser:
1. Call gyst.get_weekly_context and read the bounded week before asking anything it already answers.
2. Ask: What is missing from the picture? What did the week actually show you? What decision follows, and which dated priorities?
3. Record only what the owner said: gyst.record_missing_metric, gyst.record_weekly_observation, gyst.set_weekly_decision, gyst.set_weekly_arrow, gyst.set_weekly_priority. Ask for missing dates; never invent them.
4. Stop before commit. Say: "The weekly draft is ready for your review. Only you can commit the week."`;

export default async function WelcomeRhythmPage() {
  await requireWelcomeStage("rhythm");
  const { profile, schedules } = await getRitualReminderSchedules();
  const daily = schedules.find((schedule) => schedule.ritual_kind === "daily");
  const weekly = schedules.find((schedule) => schedule.ritual_kind === "weekly");

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Rhythm</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Your ledger is founded. Choose its rhythm.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        Reminders use the time zone you just set{profile?.timezone ? ` (${profile.timezone})` : ""}. Both are optional and can be changed any time from Schedule.
      </p>

      <div className="mt-8 grid gap-6">
        <RitualReminderScheduleForm defaultTime="20:00" description="A short evening prompt to close today and choose tomorrow’s commitment." kind="daily" profileTimezone={profile?.timezone ?? "UTC"} schedule={daily} title="Daily ritual" />
        <RitualReminderScheduleForm defaultTime="09:00" defaultWeekday={1} description="A weekly prompt to read the evidence, make a decision, and set dated priorities." kind="weekly" profileTimezone={profile?.timezone ?? "UTC"} schedule={weekly} title="Weekly ritual" />
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-background p-6" aria-labelledby="agent-skills">
        <h2 className="text-xl font-semibold" id="agent-skills">Suggested agent skills</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          If you use an agent, give it one of these. Each describes how to conduct a ritual with the tools on that page and where to stop. The commit stays yours.
        </p>
        <div className="mt-5 grid gap-6">
          <CopyableText id="daily-agent-skill" label="Daily ritual skill" rows={9} text={dailySkill} />
          <CopyableText id="weekly-agent-skill" label="Weekly ritual skill" rows={8} text={weeklySkill} />
        </div>
      </section>

      <div className="mt-8">
        <Link className="inline-block rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white" href="/daily">
          Go to today’s ritual
        </Link>
      </div>
    </section>
  );
}
