"use server";

import { getCurrentProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ReminderScheduleActionState = { message: string; status: "error" | "idle" | "success"; timezone?: string };

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function saveRitualReminderSchedule(
  _previousState: ReminderScheduleActionState,
  formData: FormData,
): Promise<ReminderScheduleActionState> {
  try {
    const ritualKind = field(formData, "ritual_kind");
    const localTime = field(formData, "local_time");
    const timezone = field(formData, "timezone");
    const enabled = field(formData, "enabled") === "on";
    const weekdayValue = field(formData, "weekday");

    if (ritualKind !== "daily" && ritualKind !== "weekly") throw new Error("Choose a valid ritual schedule.");
    if (!timePattern.test(localTime)) throw new Error("Choose a valid local reminder time.");
    if (ritualKind === "daily" && weekdayValue) throw new Error("A daily reminder does not need a weekday.");

    const weekday = ritualKind === "weekly" ? Number(weekdayValue) : null;
    if (ritualKind === "weekly" && (weekday === null || !Number.isInteger(weekday) || weekday < 1 || weekday > 7)) {
      throw new Error("Choose a day for the weekly reminder.");
    }

    const { identity, profile } = await getCurrentProfile();
    if (identity.isDemo) throw new Error("Reminder schedules are available after creating an account.");

    const supabase = await createServerSupabaseClient();
    if (!profile) {
      if (!isTimezone(timezone)) throw new Error("Your browser timezone could not be determined.");
      const { error: profileError } = await supabase.from("profiles").insert({ timezone, user_id: identity.userId });
      if (profileError && profileError.code !== "23505") throw new Error("Unable to prepare your reminder settings.");
    }
    const { error } = await supabase.rpc("save_ritual_reminder_schedule", {
      p_enabled: enabled,
      p_local_time: localTime,
      p_ritual_kind: ritualKind,
      p_weekday: weekday,
    });
    if (error) throw new Error("Unable to save this reminder schedule.");

    return {
      message: enabled ? "Reminder schedule saved." : "Reminder schedule paused.",
      status: "success",
      timezone: profile?.timezone ?? timezone,
    };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to save this reminder schedule.", status: "error" };
  }
}
