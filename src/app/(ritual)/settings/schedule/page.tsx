import { RitualReminderScheduleForm } from "@/components/ritual-reminder-schedule-form";
import { getRitualReminderSchedules } from "@/lib/reminders/schedule";

export default async function ReminderSchedulePage() {
  const { identity, profile, schedules } = await getRitualReminderSchedules();
  const daily = schedules.find((schedule) => schedule.ritual_kind === "daily");
  const weekly = schedules.find((schedule) => schedule.ritual_kind === "weekly");

  return <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Schedule</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight">Choose when GYST should nudge you.</h1>
    <p className="mt-4 max-w-2xl leading-7 text-muted">Schedules use your profile timezone. You can pause either reminder without losing its preferred time.</p>
    {identity.isDemo ? <p className="mt-6 rounded-2xl border border-line bg-background p-5 text-sm leading-6 text-muted">The demo uses a temporary fictional account, so it cannot create email reminders. Create an account to set your own schedule.</p> : <div className="mt-8 grid gap-6">
      <RitualReminderScheduleForm defaultTime="20:00" description="A short evening prompt to close today and choose tomorrow’s commitment." kind="daily" profileTimezone={profile?.timezone ?? "UTC"} schedule={daily} title="Daily ritual" />
      <RitualReminderScheduleForm defaultTime="09:00" defaultWeekday={1} description="A weekly prompt to read the evidence, make a decision, and set dated priorities." kind="weekly" profileTimezone={profile?.timezone ?? "UTC"} schedule={weekly} title="Weekly ritual" />
    </div>}
  </section>;
}
