"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/session";
import { readDailyDraft } from "@/lib/rituals/daily-draft";
import { getLocalDate } from "@/lib/rituals/daily";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DailyActionState = {
  message: string;
  status: "error" | "idle" | "success";
};

function isAlreadyCommittedError(error: { code?: string; message?: string } | null) {
  return error?.code === "23514" && error.message === "today's daily ritual is already committed";
}

function draftConflictMessage(intent: "committing" | "saving") {
  return `The daily draft changed elsewhere. Refresh before ${intent}.`;
}

function readExpectedSessionVersion(formData: FormData): number | null {
  const value = formData.get("session_version");

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new Error("The daily draft version is invalid. Refresh before saving.");
  }

  const version = Number(value);
  if (!Number.isSafeInteger(version)) {
    throw new Error("The daily draft version is invalid. Refresh before saving.");
  }

  return version;
}

async function persistDailyDraft(formData: FormData) {
  const { profile } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const draft = readDailyDraft(formData);
  const periodStart = getLocalDate(profile?.timezone ?? "UTC");
  const expectedVersion = readExpectedSessionVersion(formData);
  const draftArguments = {
    p_draft: draft,
    p_period_start: periodStart,
    ...(expectedVersion === null ? {} : { p_expected_session_version: expectedVersion }),
  };
  const { data, error } = await supabase
    .rpc("save_daily_ritual_draft", draftArguments)
    .single();

  if (error || !data) {
    if (error?.code === "40001") {
      throw new Error(draftConflictMessage("saving"));
    }
    if (isAlreadyCommittedError(error)) {
      throw new Error("Today's daily ritual is already committed.");
    }
    throw new Error("Unable to save the daily draft.");
  }

  return data;
}

export async function saveDailyDraft(
  _previousState: DailyActionState,
  formData: FormData,
): Promise<DailyActionState> {
  try {
    await persistDailyDraft(formData);
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
      p_ritual_session_id: session.ritual_session_id,
    });

    if (error?.code === "40001") {
      throw new Error(draftConflictMessage("committing"));
    }

    if (isAlreadyCommittedError(error)) {
      revalidatePath("/daily");
      return { message: "Daily ritual committed. The record is now immutable.", status: "success" };
    }

    if (error) {
      throw new Error("Complete the required daily fields and refresh if this draft changed elsewhere.");
    }

    revalidatePath("/daily");
    return { message: "Daily ritual committed. The record is now immutable.", status: "success" };
  } catch (error) {
    if (error instanceof Error && error.message === "Today's daily ritual is already committed.") {
      revalidatePath("/daily");
      return { message: "Daily ritual committed. The record is now immutable.", status: "success" };
    }
    return {
      message: error instanceof Error ? error.message : "Unable to commit the daily ritual.",
      status: "error",
    };
  }
}
