import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../../src/lib/db/database.types";
import { getLocalSupabaseEnvironment } from "./local-supabase";
import { localDailyE2EIdentity } from "./global-setup";
import { signInAsLocalOwner } from "./sign-in";

test("an owner export has exactly the committed ritual rows owned by the local database fixture", async ({ page }) => {
  const { apiUrl, serviceRoleKey } = getLocalSupabaseEnvironment();
  const admin = createClient<Database>(apiUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;
  const owner = users.users.find((user) => user.email === localDailyE2EIdentity.email);
  if (!owner) throw new Error("Local export fixture owner is missing.");

  const otherEmail = `gyst-export-isolation-${crypto.randomUUID()}@example.test`;
  const { data: otherUser, error: otherUserError } = await admin.auth.admin.createUser({
    email: otherEmail,
    email_confirm: true,
    password: "LocalExportIsolation-2026",
  });
  if (otherUserError || !otherUser.user) throw otherUserError ?? new Error("Unable to create the second local export fixture owner.");

  try {
    const otherUserId = otherUser.user.id;
    const { data: commitment, error: commitmentError } = await admin
      .from("commitments")
      .insert({ title: "Other owner action", user_id: otherUserId })
      .select("id")
      .single();
    if (commitmentError || !commitment) throw commitmentError ?? new Error("Unable to create the second owner commitment.");
    const { data: session, error: sessionError } = await admin
      .from("ritual_sessions")
      .insert({ kind: "daily", period_start: "2026-01-02", user_id: otherUserId })
      .select("id")
      .single();
    if (sessionError || !session) throw sessionError ?? new Error("Unable to create the second owner ritual session.");
    const { error: entryError } = await admin.from("daily_entries").insert({
      moved_text: "Other owner's committed record",
      next_commitment_id: commitment.id,
      previous_commitment_id: commitment.id,
      previous_commitment_outcome: "done",
      ritual_session_id: session.id,
      user_id: otherUserId,
    });
    if (entryError) throw entryError;
    const { error: commitError } = await admin.from("ritual_sessions")
      .update({ committed_at: new Date().toISOString(), status: "committed", version: 2 })
      .eq("id", session.id)
      .eq("user_id", otherUserId);
    if (commitError) throw commitError;

    await signInAsLocalOwner(page);

    const response = await page.evaluate(async () => {
      const exportResponse = await fetch("/api/exports/json");
      const markdownResponse = await fetch("/api/exports/markdown");
      return { markdown: await markdownResponse.text(), status: exportResponse.status, text: await exportResponse.text() };
    });
    expect(response.status).toBe(200);
    const exported = JSON.parse(response.text) as { format: string; rituals: Array<{ periodStart: string; status: string }> };

    const { count, error: countError } = await admin
      .from("ritual_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", owner.id)
      .eq("status", "committed");
    if (countError) throw countError;

    expect(exported.format).toBe("gyst-portable-v1");
    expect(exported.rituals).toHaveLength(count ?? 0);
    expect(exported.rituals.every((ritual) => ritual.status === "committed")).toBe(true);
    expect(exported.rituals.some((ritual) => ritual.periodStart === "2026-01-02")).toBe(false);
    expect(response.markdown).not.toContain("Other owner's committed record");
  } finally {
    await admin.auth.admin.deleteUser(otherUser.user.id);
  }
});
