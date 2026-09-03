import "server-only";

import type { Database } from "@/lib/db/database.types";
import { getCurrentProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActiveGoal = Pick<Database["public"]["Tables"]["goals"]["Row"], "id" | "title">;

export async function getActiveGoals(): Promise<ActiveGoal[]> {
  const { identity } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("goals")
    .select("id, title")
    .eq("user_id", identity.userId)
    .eq("status", "active")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load your goals.");
  }

  return data ?? [];
}
