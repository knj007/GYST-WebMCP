import "server-only";

import type { Database } from "@/lib/db/database.types";
import { getCurrentProfile } from "@/lib/auth/session";
import { type CommitmentOption, previousCommitmentOptions } from "@/lib/rituals/daily-commitments";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type DailyEntry = Pick<
  Database["public"]["Tables"]["daily_entries"]["Row"],
  | "blocker_text"
  | "blocker_type"
  | "buried_win"
  | "is_sensitive"
  | "moved_text"
  | "next_commitment_id"
  | "optional_context"
  | "previous_commitment_id"
  | "previous_commitment_outcome"
  | "version"
>;

type DailySession = Pick<
  Database["public"]["Tables"]["ritual_sessions"]["Row"],
  "committed_at" | "id" | "period_start" | "status" | "version"
>;

export type DailyRitual = {
  // Active commitments: the only choices for tomorrow's commitment.
  commitments: CommitmentOption[];
  entry: DailyEntry | null;
  periodStart: string;
  // The choices for scoring the previous commitment. On day one this also
  // carries the completed founding commitment.
  previousCommitments: CommitmentOption[];
  profile: Awaited<ReturnType<typeof getCurrentProfile>>["profile"];
  session: DailySession | null;
};

export function getLocalDate(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(new Date());
    const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    return `${fields.year}-${fields.month}-${fields.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function getDailyRitual(): Promise<DailyRitual> {
  const { identity, profile } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const periodStart = getLocalDate(profile?.timezone ?? "UTC");

  const [
    { data: session, error: sessionError },
    { data: commitments, error: commitmentsError },
    { data: committedDaily, error: committedDailyError },
    { data: onboarding, error: onboardingError },
  ] = await Promise.all([
    supabase
      .from("ritual_sessions")
      .select("id, period_start, status, version, committed_at")
      .eq("user_id", identity.userId)
      .eq("kind", "daily")
      .eq("period_start", periodStart)
      .maybeSingle(),
    supabase
      .from("commitments")
      .select("id, title, due_on")
      .eq("user_id", identity.userId)
      .eq("state", "active")
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("ritual_sessions")
      .select("id")
      .eq("user_id", identity.userId)
      .eq("kind", "daily")
      .eq("status", "committed")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("onboarding_drafts")
      .select("founding_commitment_id")
      .eq("user_id", identity.userId)
      .maybeSingle(),
  ]);

  if (sessionError || commitmentsError || committedDailyError || onboardingError) {
    throw new Error("Unable to load the daily ritual.");
  }

  const activeCommitments = commitments ?? [];
  const hasCommittedDaily = committedDaily !== null;
  let founding: CommitmentOption | null = null;

  if (!hasCommittedDaily && onboarding?.founding_commitment_id) {
    const { data: foundingCommitment, error: foundingError } = await supabase
      .from("commitments")
      .select("id, title, due_on")
      .eq("user_id", identity.userId)
      .eq("id", onboarding.founding_commitment_id)
      .maybeSingle();

    if (foundingError) {
      throw new Error("Unable to load the daily ritual.");
    }

    founding = foundingCommitment;
  }

  const previousCommitments = previousCommitmentOptions({ active: activeCommitments, founding, hasCommittedDaily });

  if (!session) {
    return { commitments: activeCommitments, entry: null, periodStart, previousCommitments, profile, session: null };
  }

  const { data: entry, error: entryError } = await supabase
    .from("daily_entries")
    .select(
      "moved_text, blocker_text, blocker_type, previous_commitment_id, previous_commitment_outcome, next_commitment_id, optional_context, buried_win, is_sensitive, version",
    )
    .eq("user_id", identity.userId)
    .eq("ritual_session_id", session.id)
    .maybeSingle();

  if (entryError) {
    throw new Error("Unable to load the daily ritual draft.");
  }

  return { commitments: activeCommitments, entry, periodStart, previousCommitments, profile, session };
}
