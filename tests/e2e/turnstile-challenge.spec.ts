import { expect, test } from "@playwright/test";

// Every other spec reaches these pages with `page.goto`, a full page load, which
// is the one arrival that always worked. `next/script` loads the Turnstile source
// at most once per page load and calls `onLoad` only from its `load` event, so a
// challenge that waits on `onLoad` alone never renders on a page reached by a
// client-side navigation -- leaving the submit control disabled until the visitor
// refreshes. These walks stay inside the router, the way a person moves.
//
// The submit control is the assertion worth making: it unlocks only once the
// widget has issued a token, so an enabled control proves a live challenge.

test("the sign-in challenge survives a client-side arrival from signup", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled({ timeout: 30_000 });

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled({ timeout: 30_000 });
});

test("the signup challenge survives a client-side arrival from the landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open the demo" })).toBeEnabled({ timeout: 30_000 });

  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signup$/);

  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled({ timeout: 30_000 });
});
