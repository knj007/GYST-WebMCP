import "server-only";

import type { Database } from "@/lib/db/database.types";
import { getCurrentProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLocalDate } from "@/lib/rituals/daily";

type WeeklyEntry = Pick<
  Database["public"]["Tables"]["weekly_entries"]["Row"],
  "arrow" | "decision_text" | "missing_metrics" | "observations" | "priorities" | "version"
>;
type WeeklySession = Pick<
  Database["public"]["Tables"]["ritual_sessions"]["Row"],
  "committed_at" | "id" | "period_start" | "status" | "version"
>;
export type WeeklyFinding = { detail: Record<string, unknown>; id: string; type: string };
export type WeeklyContext = { findings: WeeklyFinding[]; timezone: string; week_end: string; week_start: string };
export type WeeklyRitual = { context: WeeklyContext; entry: WeeklyEntry | null; periodStart: string; session: WeeklySession | null };

export function getWeekStart(timezone: string): string {
  const localDate = getLocalDate(timezone);
  const date = new Date(`${localDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function isWeeklyContext(value: unknown): value is WeeklyContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<WeeklyContext>;
  return typeof context.timezone === "string" && typeof context.week_start === "string" &&
    typeof context.week_end === "string" && Array.isArray(context.findings);
}

export async function getWeeklyRitual(): Promise<WeeklyRitual> {
  const { identity, profile } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const periodStart = getWeekStart(profile?.timezone ?? "UTC");
  const [{ data: session, error: sessionError }, { data: contextData, error: contextError }] = await Promise.all([
    supabase.from("ritual_sessions").select("id, period_start, status, version, committed_at")
      .eq("user_id", identity.userId).eq("kind", "weekly").eq("period_start", periodStart).maybeSingle(),
    supabase.rpc("get_weekly_context", { p_week_start: periodStart }),
  ]);
  if (sessionError || contextError || !isWeeklyContext(contextData)) throw new Error("Unable to load the weekly ritual.");
  if (!session) return { context: contextData, entry: null, periodStart, session: null };
  const { data: entry, error: entryError } = await supabase.from("weekly_entries")
    .select("missing_metrics, observations, decision_text, arrow, priorities, version")
    .eq("user_id", identity.userId).eq("ritual_session_id", session.id).maybeSingle();
  if (entryError) throw new Error("Unable to load the weekly ritual draft.");
  return { context: contextData, entry, periodStart, session };
}
