import "server-only";

import type { Database } from "@/lib/db/database.types";
import { getCurrentProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RitualReminderSchedule = Pick<
  Database["public"]["Tables"]["reminder_rules"]["Row"],
  "enabled" | "local_time" | "next_run_at" | "ritual_kind" | "timezone" | "weekday"
>;

export async function getRitualReminderSchedules() {
  // getCurrentProfile marks this authenticated view request-dynamic before a
  // Supabase client reads runtime-only public configuration.
  const { identity, profile } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .select("enabled, local_time, next_run_at, ritual_kind, timezone, weekday")
    .eq("user_id", identity.userId)
    .eq("is_ritual_schedule", true)
    .in("ritual_kind", ["daily", "weekly"]);

  if (error) throw new Error("Unable to load reminder schedules.");

  return { identity, profile, schedules: (data ?? []) as RitualReminderSchedule[] };
}
