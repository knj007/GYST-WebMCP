import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/lib/db/database.types";
import { getLocalSupabaseEnvironment } from "./local-supabase";

const email = "gyst-local-ritual-e2e@example.test";
const password = "LocalRitualE2E-Only-2026";
const commitmentTitle = "Local E2E next action";

async function removeExistingLocalTestIdentity() {
  const { apiUrl, serviceRoleKey } = getLocalSupabaseEnvironment();
  const client = createClient<Database>(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error || !data) {
    throw new Error("Unable to inspect the local E2E identity.");
  }

  const existing = data.users.find((user) => user.email === email);
  if (existing) {
    const { error: deleteError } = await client.auth.admin.deleteUser(existing.id);
    if (deleteError) {
      throw new Error("Unable to remove the prior local E2E identity.");
    }
  }

  return client;
}

export default async function globalSetup() {
  const client = await removeExistingLocalTestIdentity();
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (error || !data.user) {
    throw new Error("Unable to create the fictional local E2E identity.");
  }

  const userId = data.user.id;
  const [{ error: profileError }, { error: commitmentError }] = await Promise.all([
    // The fixture owner is already onboarded, so the ritual specs never meet
    // the first-run gate. The first-run spec founds its own identity instead.
    client.from("profiles").insert({ display_name: "Local E2E", onboarded_at: new Date().toISOString(), timezone: "UTC", user_id: userId }),
    client.from("commitments").insert({ title: commitmentTitle, user_id: userId }),
  ]);

  if (profileError || commitmentError) {
    await client.auth.admin.deleteUser(userId);
    throw new Error("Unable to prepare the local E2E ritual fixture.");
  }

  return async () => {
    await removeExistingLocalTestIdentity();
  };
}

export const localDailyE2EIdentity = { commitmentTitle, email, password };
