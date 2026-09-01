"use client";

import { useActionState, type FormEvent } from "react";

import { saveRitualReminderSchedule, type ReminderScheduleActionState } from "@/app/(ritual)/settings/schedule/actions";
import type { RitualReminderSchedule } from "@/lib/reminders/schedule";

const initialState: ReminderScheduleActionState = { message: "", status: "idle" };

type Props = {
  defaultTime: string;
  defaultWeekday?: number;
  description: string;
  kind: "daily" | "weekly";
  profileTimezone: string;
  schedule?: RitualReminderSchedule;
  title: string;
};

function localTime(value: string | undefined, fallback: string) {
  return value?.slice(0, 5) || fallback;
}

export function RitualReminderScheduleForm({ defaultTime, defaultWeekday, description, kind, profileTimezone, schedule, title }: Props) {
  const [state, action, pending] = useActionState(saveRitualReminderSchedule, initialState);
  function setBrowserTimezone(event: FormEvent<HTMLFormElement>) {
    const input = event.currentTarget.elements.namedItem("timezone");
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (input instanceof HTMLInputElement && detected) input.value = detected;
  }

  return <form action={action} className="rounded-2xl border border-line bg-background p-6" onSubmit={setBrowserTimezone}>
    <input name="ritual_kind" type="hidden" value={kind} />
    <input defaultValue={profileTimezone} name="timezone" type="hidden" />
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{description}</p>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input defaultChecked={schedule?.enabled ?? false} name="enabled" type="checkbox" />
        Send reminder
      </label>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold" htmlFor={`${kind}-local-time`}>
        Local time
        <input className="mt-2 w-full rounded-xl border border-line bg-surface p-3" defaultValue={localTime(schedule?.local_time, defaultTime)} id={`${kind}-local-time`} name="local_time" required type="time" />
      </label>
      {kind === "weekly" ? <label className="block text-sm font-semibold" htmlFor="weekly-weekday">
        Day
        <select className="mt-2 w-full rounded-xl border border-line bg-surface p-3" defaultValue={schedule?.weekday ?? defaultWeekday ?? 1} id="weekly-weekday" name="weekday">
          <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="7">Sunday</option>
        </select>
      </label> : <div className="text-sm leading-6 text-muted sm:pt-7">Repeats every day in your profile timezone.</div>}
    </div>
    {state.status !== "idle" ? <p aria-live="polite" className={`mt-4 text-sm ${state.status === "error" ? "text-red-700" : "text-accent"}`}>{state.message}</p> : null}
    {state.status === "success" && state.timezone ? <p className="mt-2 text-sm text-muted">Using timezone: {state.timezone}</p> : null}
    <button className="mt-5 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Save schedule"}</button>
  </form>;
}
