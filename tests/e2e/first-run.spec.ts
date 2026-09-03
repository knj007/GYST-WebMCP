import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../../src/lib/db/database.types";
import { getLocalSupabaseEnvironment } from "./local-supabase";
import { signInThroughForm } from "./sign-in";

// A brand-new owner: confirmed through the admin API so the spec can sign in
// through the ordinary form. Signing up through the real email-confirmation
// UI is out of scope here; it needs a mailbox, and the confirmation callback
// has its own unit coverage. No profile row and no commitments are seeded:
// the founding commit must create everything the first daily ritual needs.
const identity = {
  email: "gyst-local-first-run-e2e@example.test",
  password: "LocalFirstRunE2E-Only-2026",
};

let admin: SupabaseClient<Database>;

async function removeFirstRunIdentity() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data) throw new Error("Unable to inspect the first-run E2E identity.");
  const existing = data.users.find((user) => user.email === identity.email);
  if (existing) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) throw new Error("Unable to remove the first-run E2E identity.");
  }
}

test.beforeAll(async () => {
  const { apiUrl, serviceRoleKey } = getLocalSupabaseEnvironment();
  admin = createClient<Database>(apiUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await removeFirstRunIdentity();
  const { error } = await admin.auth.admin.createUser({ email: identity.email, email_confirm: true, password: identity.password });
  if (error) throw new Error("Unable to create the first-run E2E identity.");
});

test.afterAll(async () => {
  await removeFirstRunIdentity();
});

test("a new owner founds the ledger by hand and commits a first daily ritual", async ({ page }) => {
  // The sign-in action lands on /daily; the ritual layout bounces a new owner
  // to the welcome pages because the profile row does not exist yet.
  await signInThroughForm(page, identity, /\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Found your ledger");
  await expect(page.getByText("It may never commit, delete, export, or read your history.")).toBeVisible();

  // The ritual pages stay gated until the founding commit.
  await page.goto("/daily");
  await expect(page).toHaveURL(/\/welcome$/);

  await page.getByRole("link", { name: "Set your goals" }).click();
  await expect(page).toHaveURL(/\/welcome\/goals$/);
  await expect(page.getByRole("textbox", { name: "Agent prompt" })).toHaveValue(/cannot commit anything/);
  await expect(page.getByText("Save your draft to continue to review.")).toBeVisible();

  // Row labels repeat across groups (a goal also has an "Area"), so the
  // locators name the control role as a person would tell them apart.
  const areaTitle = page.getByRole("textbox", { name: "Area", exact: true });
  const goalTitle = page.getByRole("textbox", { name: "Goal", exact: true });
  const commitmentTitle = page.getByRole("textbox", { name: "Commitment", exact: true });

  await page.locator("#display_name").fill("First Run");
  // The zone list is a browser value, so the select appears after hydration.
  await page.getByRole("combobox", { name: "Time zone" }).selectOption("America/Chicago");

  await page.getByRole("button", { name: "Add area" }).click();
  await areaTitle.fill("Fictional studio");

  await page.getByRole("button", { name: "Add goal" }).click();
  await goalTitle.fill("Publish the fictional field guide");
  await page.getByLabel("Why it matters").fill("It is the studio's first real release.");
  await page.getByLabel("How much it matters").selectOption("5");

  await page.getByRole("button", { name: "Add commitment" }).click();
  await commitmentTitle.fill("Outline the first chapter");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved. Nothing is committed until you review it.")).toBeVisible();

  // The draft survives a reload with the same rows and is still uncommitted.
  await page.reload();
  await expect(areaTitle).toHaveValue("Fictional studio");
  await expect(goalTitle).toHaveValue("Publish the fictional field guide");
  await expect(commitmentTitle).toHaveValue("Outline the first chapter");
  await expect(page.getByRole("combobox", { name: "Time zone" })).toHaveValue("America/Chicago");

  await page.getByRole("link", { name: "Continue to review" }).click();
  await expect(page).toHaveURL(/\/welcome\/review$/);
  await expect(page.getByText("This founding statement is immutable and dated")).toBeVisible();
  await expect(page.getByText("Publish the fictional field guide")).toBeVisible();
  await expect(page.getByText("Outline the first chapter")).toBeVisible();

  await page.getByRole("button", { name: "Commit founding statement" }).click();
  await expect(page).toHaveURL(/\/welcome\/rhythm$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your ledger is founded.");
  await expect(page.getByText("(America/Chicago)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daily ritual" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Weekly ritual" })).toBeVisible();
  await expect(page.getByLabel("Daily ritual skill")).toHaveValue(/Stop before commit/);

  // Once founded, the pre-commit welcome pages send the owner to the ritual.
  await page.goto("/welcome/goals");
  await expect(page).toHaveURL(/\/daily$/);
  await page.goto("/welcome/rhythm");
  await expect(page).toHaveURL(/\/welcome\/rhythm$/);

  await page.getByRole("link", { name: "Go to today’s ritual" }).click();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Close the day with intention, First Run.");

  // Day one: the founding commitment is the previous choice; the real
  // commitment is the only next choice.
  const previous = page.getByLabel("Score the previous commitment");
  await expect(previous.getByRole("option", { name: "Founded this GYST ledger (day one)" })).toHaveCount(1);
  const next = page.getByLabel("Choose tomorrow's commitment");
  await expect(next.getByRole("option", { name: "Founded this GYST ledger (day one)" })).toHaveCount(0);
  await expect(next.getByRole("option", { name: "Outline the first chapter" })).toHaveCount(1);

  await page.getByLabel("What moved today?").fill("Founded the ledger and named the first goal.");
  await previous.selectOption({ label: "Founded this GYST ledger (day one)" });
  await page.getByLabel("Outcome").selectOption("done");
  await next.selectOption({ label: "Outline the first chapter" });
  await page.getByRole("button", { name: "Commit today" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Today's record is committed.");

  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Today's record is committed.");
  await expect(page.getByRole("button", { name: "Commit today" })).toHaveCount(0);
});
