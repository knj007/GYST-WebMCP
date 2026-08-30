"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/db/database.types";
import { getLocalDate } from "@/lib/rituals/daily";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type DailyActionState = {
  message: string;
  status: "error" | "idle" | "success";
};

type DailyDraft = {
  blocker_text: string | null;
  blocker_type: Database["public"]["Enums"]["blocker_type"] | null;
  buried_win: string | null;
  is_sensitive: boolean;
  moved_text: string | null;
  next_commitment_id: string | null;
  optional_context: string | null;
  previous_commitment_id: string | null;
  previous_commitment_outcome: Database["public"]["Enums"]["commitment_outcome"] | null;
};

const blockerTypes = new Set<DailyDraft["blocker_type"]>([
  "internal",
  "external_gate",
  "capacity",
  "clarity",
  "dependency",
  "other",
]);
const outcomes = new Set<DailyDraft["previous_commitment_outcome"]>([
  "done",
  "partial",
  "deferred",
  "not_done",
  "planned_skip",
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const initialDailyActionState: DailyActionState = { message: "", status: "idle" };

function valueAsText(formData: FormData, field: string, maximumLength: number): string | null {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maximumLength) {
    throw new Error("One of the draft fields is too long.");
  }

  return trimmed;
}

function valueAsUuid(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

function valueFromSet<T extends string>(formData: FormData, field: string, allowed: Set<T | null>): T | null {
  const value = formData.get(field);
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : null;
}

function readDailyDraft(formData: FormData): DailyDraft {
  const blockerText = valueAsText(formData, "blocker_text", 8000);

  return {
    blocker_text: blockerText,
    blocker_type: blockerText ? valueFromSet(formData, "blocker_type", blockerTypes) : null,
    buried_win: valueAsText(formData, "buried_win", 4000),
    is_sensitive: formData.get("is_sensitive") === "on",
    moved_text: valueAsText(formData, "moved_text", 12000),
    next_commitment_id: valueAsUuid(formData, "next_commitment_id"),
    optional_context: valueAsText(formData, "optional_context", 12000),
    previous_commitment_id: valueAsUuid(formData, "previous_commitment_id"),
    previous_commitment_outcome: valueFromSet(formData, "previous_commitment_outcome", outcomes),
  };
}

async function persistDailyDraft(formData: FormData) {
  const { identity, profile } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const draft = readDailyDraft(formData);
  const periodStart = getLocalDate(profile?.timezone ?? "UTC");

  const { data: existingSession, error: sessionReadError } = await supabase
    .from("ritual_sessions")
    .select("id, status, version")
    .eq("user_id", identity.userId)
    .eq("kind", "daily")
    .eq("period_start", periodStart)
    .maybeSingle();

  if (sessionReadError) {
    throw new Error("Unable to load the daily draft.");
  }

  if (existingSession?.status === "committed") {
    throw new Error("Today's daily ritual is already committed.");
  }

  let session = existingSession;
  if (!session) {
    const { data, error } = await supabase
      .from("ritual_sessions")
      .insert({ kind: "daily", period_start: periodStart, user_id: identity.userId })
      .select("id, status, version")
      .single();

    if (error) {
      throw new Error("Unable to create the daily draft.");
    }
    session = data;
  } else {
    const { data, error } = await supabase
      .from("ritual_sessions")
      .update({ version: session.version + 1 })
      .eq("id", session.id)
      .eq("user_id", identity.userId)
      .eq("version", session.version)
      .select("id, status, version")
      .maybeSingle();

    if (error || !data) {
      throw new Error("The daily draft changed elsewhere. Refresh before saving.");
    }
    session = data;
  }

  const { data: existingEntry, error: entryReadError } = await supabase
    .from("daily_entries")
    .select("id, version")
    .eq("user_id", identity.userId)
    .eq("ritual_session_id", session.id)
    .maybeSingle();

  if (entryReadError) {
    throw new Error("Unable to load the daily entry.");
  }

  if (existingEntry) {
    const { data, error } = await supabase
      .from("daily_entries")
      .update({ ...draft, version: existingEntry.version + 1 })
      .eq("id", existingEntry.id)
      .eq("user_id", identity.userId)
      .eq("version", existingEntry.version)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new Error("The daily entry changed elsewhere. Refresh before saving.");
    }
  } else {
    const { error } = await supabase.from("daily_entries").insert({
      ...draft,
      ritual_session_id: session.id,
      user_id: identity.userId,
    });

    if (error) {
      throw new Error("Unable to save the daily entry.");
    }
  }

  return session;
}

export async function saveDailyDraft(
  _previousState: DailyActionState,
  formData: FormData,
): Promise<DailyActionState> {
  try {
    await persistDailyDraft(formData);
    revalidatePath("/daily");
    return { message: "Draft saved. Only you can commit the final record.", status: "success" };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to save the daily draft.",
      status: "error",
    };
  }
}

export async function commitDailyRitual(
  _previousState: DailyActionState,
  formData: FormData,
): Promise<DailyActionState> {
  try {
    const session = await persistDailyDraft(formData);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("commit_daily_ritual", {
      p_expected_version: session.version,
      p_idempotency_key: crypto.randomUUID(),
      p_ritual_session_id: session.id,
    });

    if (error) {
      throw new Error("Complete the required daily fields and refresh if this draft changed elsewhere.");
    }

    revalidatePath("/daily");
    return { message: "Daily ritual committed. The record is now immutable.", status: "success" };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to commit the daily ritual.",
      status: "error",
    };
  }
}
