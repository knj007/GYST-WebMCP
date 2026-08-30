import { expect, test } from "@playwright/test";

test("loads the foundation and protects ritual routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("quiet ledger");

  await page.getByRole("link", { name: "Start the daily ritual" }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
