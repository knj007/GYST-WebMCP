"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AccountDeletionState = { message: string; status: "error" | "idle" };

export async function deleteMyAccount(_previousState: AccountDeletionState, formData: FormData): Promise<AccountDeletionState> {
  if (formData.get("confirmation") !== "DELETE") {
    return { message: "Type DELETE exactly to confirm account deletion.", status: "error" };
  }

  try {
    const identity = await requireUser();
    if (identity.isDemo) return { message: "Demo accounts cannot be deleted from settings.", status: "error" };

    const { error } = await (await createServerSupabaseClient()).rpc("delete_my_account");
    if (error) throw error;

    const cookieStore = await cookies();
    for (const cookie of cookieStore.getAll()) if (cookie.name.startsWith("sb-")) cookieStore.delete(cookie.name);
  } catch {
    return { message: "Unable to delete your account. Your records have not been changed.", status: "error" };
  }

  redirect("/login?deleted=1");
}
