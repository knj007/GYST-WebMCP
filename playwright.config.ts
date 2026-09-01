import { defineConfig, devices } from "@playwright/test";

import { getLocalSupabasePublicEnvironment } from "./tests/e2e/local-supabase";

const localSupabase = getLocalSupabasePublicEnvironment();

export default defineConfig({
  testDir: "./tests/e2e",
  // Every E2E file uses the same fictional owner created by global setup, so
  // parallel workers can race a draft/commit against an export assertion.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localSupabase.publishableKey,
      NEXT_PUBLIC_SUPABASE_URL: localSupabase.apiUrl,
      // Cloudflare's documented always-passes Turnstile test site key. It is a
      // public dummy value, not a secret. The local Supabase stack has captcha
      // disabled, so the token it issues is accepted and ignored.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    },
  },
});
