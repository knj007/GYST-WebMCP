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

test("one demo visitor's writes are invisible to another", async ({ browser }) => {
  const draft = "Only the first demo session wrote this.";

  async function openDemo(context: import("@playwright/test").BrowserContext) {
    const page = await context.newPage();
    await page.goto("/");
    const openDemoButton = page.getByRole("button", { name: "Open the demo" });
    await expect(openDemoButton).toBeEnabled({ timeout: 30_000 });
    await openDemoButton.click();
    await expect(page).toHaveURL(/\/daily$/);
    return page;
  }

  const [first, second] = await Promise.all([browser.newContext(), browser.newContext()]);
  const firstPage = await openDemo(first);

  // Saving is the write path this suite can rely on: the draft persists even
  // though its confirmation message does not render (a defect that predates the
  // judge demo). A reload proves the write landed.
  await firstPage.getByLabel("What moved today?").fill(draft);
  await firstPage.getByRole("button", { name: "Save draft" }).click();
  await firstPage.reload();
  await expect(firstPage.getByLabel("What moved today?")).toHaveValue(draft);

  // The second visitor must see an untouched ledger, not the first one's draft.
  const secondPage = await openDemo(second);
  await expect(secondPage.getByLabel("What moved today?")).toHaveValue("");

  // And the first visitor still has their own work.
  await firstPage.reload();
  await expect(firstPage.getByLabel("What moved today?")).toHaveValue(draft);

  await Promise.all([first.close(), second.close()]);
});
