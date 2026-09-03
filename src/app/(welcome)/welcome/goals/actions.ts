"use server";

import { unstable_rethrow } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/session";
import { readOnboardingDraft, readOnboardingDraftVersion } from "@/lib/onboarding/draft";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type OnboardingDraftActionState = {
  draftId?: string;
  message: string;
  status: "error" | "idle" | "success";
  version?: number;
};

const demoRefusal = "demo sessions cannot onboard";

/**
 * Save the onboarding draft. This action only ever calls the draft RPC; the
 * founding commit lives in the review page's action and nowhere else.
 */
export async function saveOnboardingDraft(
  _previousState: OnboardingDraftActionState,
  formData: FormData,
): Promise<OnboardingDraftActionState> {
  try {
    const { identity } = await getCurrentProfile();
    if (identity.isDemo) {
      throw new Error("The demo ledger is already prepared. Open the daily ritual instead.");
    }

    const draft = readOnboardingDraft(formData);
    const expectedVersion = readOnboardingDraftVersion(formData);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .rpc("save_onboarding_draft", {
        p_draft: draft,
        ...(expectedVersion === null ? {} : { p_expected_version: expectedVersion }),
      })
      .single();

    if (error || !data) {
      if (error?.code === "40001") {
        throw new Error("The onboarding draft changed elsewhere. Refresh before saving.");
      }
      if (error?.code === "23514") {
        throw new Error("Your founding statement is already committed. Open the daily ritual instead.");
      }
      if (error?.code === "22023") {
        throw new Error(error.message);
      }
      if (error?.code === "42501" && error.message === demoRefusal) {
        throw new Error("The demo ledger is already prepared. Open the daily ritual instead.");
      }
      throw new Error("Unable to save the onboarding draft.");
    }

    return {
      draftId: data.onboarding_draft_id,
      message: "Draft saved. Nothing is committed until you review it.",
      status: "success",
      version: data.version,
    };
  } catch (error) {
    // A redirect thrown by requireUser is a framework signal, not a failure.
    unstable_rethrow(error);
    return {
      message: error instanceof Error ? error.message : "Unable to save the onboarding draft.",
      status: "error",
    };
  }
}
