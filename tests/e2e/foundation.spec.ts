import { expect, test } from "@playwright/test";

test("loads the foundation and reaches ritual routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("quiet ledger");

  await page.getByRole("link", { name: "Start the daily ritual" }).click();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Close the day");
});
