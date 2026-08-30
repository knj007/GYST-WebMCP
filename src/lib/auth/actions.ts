"use server";

import { redirect } from "next/navigation";

import { readSupabasePublicConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || email.length > 320 || !password || password.length > 1024) {
    redirect("/login?error=invalid");
  }

  if (!readSupabasePublicConfig()) {
    redirect("/login?reason=configuration");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=credentials");
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
