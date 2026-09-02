"use server";

import { redirect } from "next/navigation";

import { isSignInChallengeConfigured, signInWithTurnstile } from "@/lib/auth/sign-in";
import { readSupabasePublicConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  if (!readSupabasePublicConfig()) {
    redirect("/login?reason=configuration");
  }

  const result = await signInWithTurnstile(
    {
      email: formData.get("email"),
      password: formData.get("password"),
      turnstileToken: formData.get("turnstileToken"),
    },
    {
      createClient: createServerSupabaseClient,
      requiresChallenge: isSignInChallengeConfigured(),
    },
  );

  if (!result.ok) {
    redirect(`/login?error=${result.code}`);
  }

  redirect("/daily");
}

export async function signOut() {
  if (!readSupabasePublicConfig()) {
    redirect("/login?reason=configuration");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    redirect("/daily?error=signout");
  }

  redirect("/login");
}
