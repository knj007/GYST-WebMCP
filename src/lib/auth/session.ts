import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { readSupabasePublicConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type VerifiedIdentity = {
  email: string | null;
  // A demo session is a Supabase anonymous user. It takes the same
  // `authenticated` Postgres role as a permanent account, so every owner-only
  // policy already applies to it; this flag exists so the interface can say
  // plainly that the ledger in view is fictional and unrecoverable.
  isDemo: boolean;
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

  if (error || typeof claims?.sub !== "string" || claims.sub.length === 0) {
    redirect("/login");
  }

  return {
    email: typeof claims.email === "string" ? claims.email : null,
    isDemo: claims.is_anonymous === true,
    userId: claims.sub,
  };
});

export const getCurrentProfile = cache(async () => {
  const identity = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, onboarded_at, ritual_version, timezone")
    .eq("user_id", identity.userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the signed-in profile.");
  }

  return { identity, profile: data };
});
