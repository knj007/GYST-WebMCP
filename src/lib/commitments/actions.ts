"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AddCommitmentActionState = { message: string; status: "error" | "idle" | "success" };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The human-only pump: one active commitment under an owned active goal.
 * No WebMCP tool reaches this action; a unit test holds that boundary.
 */
export async function addCommitment(
  _previousState: AddCommitmentActionState,
  formData: FormData,
): Promise<AddCommitmentActionState> {
  try {
    const goalId = text(formData, "goal_id");
    const title = text(formData, "title");
    const details = text(formData, "details");
    const dueOn = text(formData, "due_on");

    if (!uuidPattern.test(goalId)) throw new Error("Choose the goal this commitment serves.");
    if (title.length === 0 || title.length > 500) throw new Error("A commitment title must be between 1 and 500 characters.");
    if (details.length > 8000) throw new Error("Commitment details must be at most 8000 characters.");
    if (dueOn && !datePattern.test(dueOn)) throw new Error("Choose a valid due date.");

    await getCurrentProfile();
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("add_commitment", {
      p_details: details || undefined,
      p_due_on: dueOn || undefined,
      p_goal_id: goalId,
      p_title: title,
    });

    if (error) {
      if (error.code === "42501") throw new Error("That goal was not found in your ledger.");
      if (error.code === "23514") throw new Error("Commitments can only be added to an active goal.");
      if (error.code === "22023") throw new Error(error.message);
      throw new Error("Unable to add the commitment.");
    }

    revalidatePath("/daily");
    revalidatePath("/weekly");
    return { message: "Commitment added. It is active and can be chosen as tomorrow’s commitment.", status: "success" };
  } catch (error) {
    // A redirect thrown by requireUser is a framework signal, not a failure.
    unstable_rethrow(error);
    return { message: error instanceof Error ? error.message : "Unable to add the commitment.", status: "error" };
  }
}
