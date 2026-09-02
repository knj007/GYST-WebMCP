import { expect, type Page } from "@playwright/test";

import { localDailyE2EIdentity } from "./global-setup";

/**
 * Sign the fictional local owner in through the ordinary form.
 *
 * Sign-in is behind the same Turnstile challenge as signup, so the submit
 * control stays disabled until the widget resolves — the same wait a person
 * makes. The widget is fetched from Cloudflare, so allow more room than the
 * default action timeout gives.
 */
export async function signInAsLocalOwner(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(localDailyE2EIdentity.email);
  await page.getByLabel("Password").fill(localDailyE2EIdentity.password);

  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();

  await expect(page).toHaveURL(/\/daily$/);
}
