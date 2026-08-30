import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { readSupabasePublicConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type VerifiedIdentity = {
  email: string | null;
  userId: string;
};

export const requireUser = cache(async (): Promise<VerifiedIdentity> => {
  // Authenticated output is always request-specific, even in an environment
  // whose public Supabase values are intentionally absent at build time.
  await connection();

  if (!readSupabasePublicConfig()) {
    redirect("/login?reason=configuration");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (
    error ||
    typeof claims?.sub !== "string" ||
    claims.sub.length === 0 ||
    claims.is_anonymous === true
  ) {
    redirect("/login");
  }

  return {
    email: typeof claims.email === "string" ? claims.email : null,
    userId: claims.sub,
  };
});

export const getCurrentProfile = cache(async () => {
  const identity = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, ritual_version, timezone")
    .eq("user_id", identity.userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the signed-in profile.");
  }

  return { identity, profile: data };
});
