import { expect, type Page } from "@playwright/test";

import { localDailyE2EIdentity } from "./global-setup";

type Credentials = { email: string; password: string };

/**
 * Sign an identity in through the ordinary form and wait for its landing page.
 *
 * Sign-in is behind the same Turnstile challenge as signup, so the submit
 * control stays disabled until the widget resolves — the same wait a person
 * makes. The widget is fetched from Cloudflare, so allow more room than the
 * default action timeout gives.
 */
export async function signInThroughForm(page: Page, { email, password }: Credentials, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();

  await expect(page).toHaveURL(landing);
}

/** Sign the fictional, already-onboarded local owner in; it lands on the daily ritual. */
export async function signInAsLocalOwner(page: Page) {
  await signInThroughForm(page, localDailyE2EIdentity, /\/daily$/);
}
