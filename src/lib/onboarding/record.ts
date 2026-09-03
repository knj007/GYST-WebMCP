import "server-only";

import type { Database } from "@/lib/db/database.types";
import { getCurrentProfile } from "@/lib/auth/session";
import { type OnboardingDraft, parseOnboardingDraft } from "@/lib/onboarding/draft";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type OnboardingDraftRow = Pick<
  Database["public"]["Tables"]["onboarding_drafts"]["Row"],
  "committed_at" | "draft" | "founding_commitment_id" | "id" | "status" | "version"
>;

export type OnboardingRecord = Omit<OnboardingDraftRow, "draft"> & { draft: OnboardingDraft };

export type OnboardingState = {
  identity: Awaited<ReturnType<typeof getCurrentProfile>>["identity"];
  profile: Awaited<ReturnType<typeof getCurrentProfile>>["profile"];
  record: OnboardingRecord | null;
};

export async function getOnboardingRecord(): Promise<OnboardingState> {
  const { identity, profile } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("onboarding_drafts")
    .select("id, draft, status, version, committed_at, founding_commitment_id")
    .eq("user_id", identity.userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the onboarding draft.");
  }

  if (!data) {
    return { identity, profile, record: null };
  }

  let draft: OnboardingDraft;
  try {
    draft = parseOnboardingDraft(data.draft);
  } catch {
    throw new Error("The stored onboarding draft could not be read.");
  }

  return { identity, profile, record: { ...data, draft } };
}
