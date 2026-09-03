"use server";

import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CommitOnboardingActionState = {
  // A validation failure the owner can repair by editing the draft.
  fixable?: boolean;
  message: string;
  status: "error" | "idle" | "success";
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readDraftId(formData: FormData) {
  const value = formData.get("draft_id");
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("The onboarding draft could not be identified. Refresh before committing.");
  }
  return value;
}

function readExpectedVersion(formData: FormData) {
  const value = formData.get("draft_version");
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("The onboarding draft version is invalid. Refresh before committing.");
  }
  return Number(value);
}

/**
 * The founding commit: human-only, optimistic on the draft version, and
 * idempotent on replay because the RPC returns the stored result for a draft
 * that is already committed.
 */
export async function commitOnboarding(
  _previousState: CommitOnboardingActionState,
  formData: FormData,
): Promise<CommitOnboardingActionState> {
  let committed = false;
  let demo = false;

  try {
    const { identity } = await getCurrentProfile();
    if (identity.isDemo) {
      demo = true;
      throw new Error("The demo ledger is already prepared.");
    }

    const draftId = readDraftId(formData);
    const expectedVersion = readExpectedVersion(formData);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .rpc("commit_onboarding", { p_expected_version: expectedVersion, p_onboarding_draft_id: draftId })
      .single();

    if (error || !data) {
      if (error?.code === "40001") {
        throw new Error("The onboarding draft changed elsewhere. Refresh before committing.");
      }
      if (error?.code === "22023") {
        return { fixable: true, message: error.message, status: "error" };
      }
      if (error?.code === "23514") {
        return { fixable: true, message: error.message, status: "error" };
      }
      if (error?.code === "42501" && error.message === "demo sessions cannot onboard") {
        demo = true;
        throw new Error("The demo ledger is already prepared.");
      }
      throw new Error("Unable to commit the founding statement.");
    }

    committed = true;
  } catch (error) {
    if (!demo) {
      return {
        message: error instanceof Error ? error.message : "Unable to commit the founding statement.",
        status: "error",
      };
    }
  }

  // redirect throws a framework signal, so it stays outside the try block.
  if (demo) {
    redirect("/daily");
  }
  if (committed) {
    redirect("/welcome/rhythm");
  }

  return { message: "Unable to commit the founding statement.", status: "error" };
}
