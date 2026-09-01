"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { getWeekStart } from "@/lib/rituals/weekly";
import { readWeeklyDraft } from "@/lib/rituals/weekly-draft";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type WeeklyActionState = { message: string; status: "error" | "idle" | "success" };

function expectedVersion(formData: FormData) {
  const value = formData.get("session_version");
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("The weekly draft version is invalid. Refresh before saving.");
  }
  return Number(value);
}

async function persistWeeklyDraft(formData: FormData) {
  const { profile } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const version = expectedVersion(formData);
  const { data, error } = await supabase.rpc("save_weekly_ritual_draft", {
    p_draft: readWeeklyDraft(formData),
    p_period_start: getWeekStart(profile?.timezone ?? "UTC"),
    ...(version === null ? {} : { p_expected_session_version: version }),
  }).single();
  if (error || !data) {
    if (error?.code === "40001") throw new Error("The weekly draft changed elsewhere. Refresh before saving.");
    if (error?.code === "23514" && error.message === "this weekly ritual is already committed") throw new Error(error.message);
    throw new Error("Unable to save the weekly draft.");
  }
  return data;
}

export async function saveWeeklyDraft(_state: WeeklyActionState, formData: FormData): Promise<WeeklyActionState> {
  try {
    await persistWeeklyDraft(formData);
    return { message: "Weekly draft saved. Only you can commit the final record.", status: "success" };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to save the weekly draft.", status: "error" };
  }
}

export async function commitWeeklyRitual(_state: WeeklyActionState, formData: FormData): Promise<WeeklyActionState> {
  try {
    const session = await persistWeeklyDraft(formData);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("commit_weekly_ritual", {
      p_expected_version: session.version,
      p_ritual_session_id: session.ritual_session_id,
    });
    if (error?.code === "40001") throw new Error("The weekly draft changed elsewhere. Refresh before committing.");
    if (error) throw new Error("Add a decision, an arrow, and at least one dated priority before committing.");
    revalidatePath("/weekly");
    return { message: "Weekly ritual committed. The record is now immutable.", status: "success" };
  } catch (error) {
    if (error instanceof Error && error.message === "this weekly ritual is already committed") {
      revalidatePath("/weekly");
      return { message: "Weekly ritual committed. The record is now immutable.", status: "success" };
    }
    return { message: error instanceof Error ? error.message : "Unable to commit the weekly ritual.", status: "error" };
  }
}
