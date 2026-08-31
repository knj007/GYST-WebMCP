import { expect, test } from "@playwright/test";

import { localDailyE2EIdentity } from "./global-setup";

test("an authenticated local owner can save, resume, and commit the ordinary daily form", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(localDailyE2EIdentity.email);
  await page.getByLabel("Password").fill(localDailyE2EIdentity.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Close the day with intention, Local E2E.");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Commit today" })).toBeVisible();

  await page.getByLabel("What moved today?").fill("Finished the fictional local ritual flow.");
  await page.getByLabel("Score the previous commitment").selectOption({ label: localDailyE2EIdentity.commitmentTitle });
  await page.getByLabel("Outcome").selectOption("done");
  await page
    .getByLabel("Choose tomorrow's commitment")
    .selectOption({ label: localDailyE2EIdentity.commitmentTitle });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved. Only you can commit the final record.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("What moved today?")).toHaveValue("Finished the fictional local ritual flow.");
  await expect(page.getByText(/Your draft daily record is for/)).toBeVisible();

  await page.getByRole("button", { name: "Commit today" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Today's record is committed.");

  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Today's record is committed.");
  await expect(page.getByRole("button", { name: "Commit today" })).toHaveCount(0);
});
