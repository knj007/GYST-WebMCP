import { expect, test } from "@playwright/test";

// The judge demo is the only entry point that reaches an authenticated ritual
// without an account. It must land on a populated fictional ledger, say plainly
// that the ledger is a demo, and still leave the commit to the person.
test("a visitor opens a populated demo ledger in one click and no account", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Look around first" })).toBeVisible();

  const openDemo = page.getByRole("button", { name: "Open the demo" });
  await expect(openDemo).toBeEnabled({ timeout: 30_000 });
  await openDemo.click();

  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByText("Demo session.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fictional demo owner");

  // Seeded history is present and the commitments it scored are selectable, so
  // the ritual can be conducted rather than merely displayed.
  await expect(
    page.getByLabel("Score the previous commitment").getByRole("option", {
      name: "Write the fictional accessibility chapter",
    }),
  ).toHaveCount(1);

  // Today is deliberately left open: the demo session commits its own record.
  await expect(page.getByRole("button", { name: "Commit today" })).toBeVisible();

  await page.goto("/weekly");
  await expect(page.getByText("Demo session.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Read before you ask.");
});

test("each demo visitor receives a separate ledger", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);

  const userIds = await Promise.all(
    contexts.map(async (context) => {
      const page = await context.newPage();
      await page.goto("/");
      const openDemo = page.getByRole("button", { name: "Open the demo" });
      await expect(openDemo).toBeEnabled({ timeout: 30_000 });
      await openDemo.click();
      await expect(page).toHaveURL(/\/daily$/);

      // The Supabase session cookie carries the demo identity. Two independent
      // visitors must never share one.
      const cookies = await context.cookies();
      return cookies
        .filter((cookie) => cookie.name.startsWith("sb-"))
        .map((cookie) => cookie.value)
        .join("|");
    }),
  );

  expect(userIds[0]).not.toBe("");
  expect(userIds[0]).not.toBe(userIds[1]);

  await Promise.all(contexts.map((context) => context.close()));
});
