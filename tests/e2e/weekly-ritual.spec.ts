import { expect, test } from "@playwright/test";
import { signInAsLocalOwner } from "./sign-in";

test("an authenticated local owner can save, resume, and commit the ordinary weekly form", async ({ page }) => {
  await signInAsLocalOwner(page);
  await page.goto("/weekly");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Read before you ask.");
  await page.getByLabel("Observations").fill("The fictional weekly flow is intact.");
  await page.getByLabel("Decision").fill("Protect the fictional review window.");
  await page.getByLabel("Arrow").selectOption("up");
  await page.getByLabel("Dated priorities").fill("Publish fictional summary | 2026-09-07");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Weekly draft saved. Only you can commit the final record.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Decision")).toHaveValue("Protect the fictional review window.");
  await page.getByRole("button", { name: "Commit week" }).click();
  await expect(page.getByRole("heading", { name: "This week's record is committed." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "This week's record is committed." })).toBeVisible();
});
