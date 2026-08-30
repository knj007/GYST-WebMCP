import "server-only";

import type { Database } from "@/lib/db/database.types";
import { getCurrentProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RitualKind = Database["public"]["Enums"]["ritual_kind"];

export async function getRitualLanding(kind: RitualKind) {
  const { identity, profile } = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ritual_sessions")
    .select("id, period_start, status, version")
    .eq("user_id", identity.userId)
    .eq("kind", kind)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load the ${kind} ritual.`);
  }

  return { identity, profile, session: data };
}
