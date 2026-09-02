import { beforeEach, describe, expect, test, vi } from "vitest";

import { isSignInChallengeConfigured, signInWithTurnstile } from "@/lib/auth/sign-in";

const input = {
  email: " Person@Example.test ",
  password: "an-example-password",
  turnstileToken: "valid-token",
};

function dependencies(error: { message?: string } | null = null, requiresChallenge = true) {
  const signInWithPassword = vi.fn().mockResolvedValue({ error });
  return {
    createClient: vi.fn().mockResolvedValue({ auth: { signInWithPassword } }),
    requiresChallenge,
    signInWithPassword,
  };
}

describe("Turnstile-protected sign-in", () => {
  beforeEach(() => vi.restoreAllMocks());

  test("sends the captcha token to Auth and normalizes the email", async () => {
    const deps = dependencies();
    await expect(signInWithTurnstile(input, deps)).resolves.toEqual({ code: "success", ok: true });
    expect(deps.signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.test",
      options: { captchaToken: "valid-token" },
      password: "an-example-password",
    });
  });

  test("rejects a missing token before reaching Auth when a challenge is required", async () => {
    const deps = dependencies();
    await expect(signInWithTurnstile({ ...input, turnstileToken: "" }, deps)).resolves.toEqual({
      code: "challenge",
      ok: false,
    });
    expect(deps.signInWithPassword).not.toHaveBeenCalled();
  });

  test("rejects an oversized token before reaching Auth", async () => {
    const deps = dependencies();
    await expect(
      signInWithTurnstile({ ...input, turnstileToken: "t".repeat(2049) }, deps),
    ).resolves.toEqual({ code: "challenge", ok: false });
    expect(deps.signInWithPassword).not.toHaveBeenCalled();
  });

  test.each([
    ["a missing email", { email: "" }],
    ["an oversized email", { email: `${"a".repeat(320)}@example.test` }],
    ["a missing password", { password: "" }],
    ["an oversized password", { password: "p".repeat(1025) }],
  ])("rejects %s before reaching Auth", async (_label, override) => {
    const deps = dependencies();
    await expect(signInWithTurnstile({ ...input, ...override }, deps)).resolves.toEqual({
      code: "invalid",
      ok: false,
    });
    expect(deps.signInWithPassword).not.toHaveBeenCalled();
  });

  test("omits the captcha option when no challenge is configured", async () => {
    const deps = dependencies(null, false);
    await expect(
      signInWithTurnstile({ ...input, turnstileToken: "" }, deps),
    ).resolves.toEqual({ code: "success", ok: true });
    expect(deps.signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.test",
      password: "an-example-password",
    });
  });

  test("reports a rejected challenge as recoverable rather than as bad credentials", async () => {
    const deps = dependencies({ message: "captcha protection: request disallowed (captcha_failed)" });
    await expect(signInWithTurnstile(input, deps)).resolves.toEqual({
      code: "challenge",
      ok: false,
    });
  });

  test("reports any other Auth failure as a credentials failure", async () => {
    const deps = dependencies({ message: "Invalid login credentials" });
    await expect(signInWithTurnstile(input, deps)).resolves.toEqual({
      code: "credentials",
      ok: false,
    });
  });
});

describe("sign-in challenge configuration", () => {
  test.each([
    ["a present site key", { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "public-site-key" }, true],
    ["a blank site key", { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "   " }, false],
    ["no site key", {}, false],
  ])("reports %s", (_label, environment, expected) => {
    expect(isSignInChallengeConfigured(environment as NodeJS.ProcessEnv)).toBe(expected);
  });
});
