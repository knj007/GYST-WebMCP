import { beforeEach, describe, expect, test, vi } from "vitest";

import { isSignupConfigured, signUpWithTurnstile } from "@/lib/auth/signup";

const input = {
  email: " person@example.test ",
  password: "an-example-password",
  turnstileToken: "valid-token",
};

function dependencies() {
  const signUp = vi.fn().mockResolvedValue({ error: null });
  return { createClient: vi.fn().mockResolvedValue({ auth: { signUp } }), signUp };
}

describe("Turnstile-protected signup", () => {
  beforeEach(() => vi.restoreAllMocks());

  test("rejects a missing token before reaching Auth", async () => {
    const deps = dependencies();
    await expect(signUpWithTurnstile({ ...input, turnstileToken: "" }, deps)).resolves.toEqual({
      code: "challenge",
      ok: false,
    });
    expect(deps.signUp).not.toHaveBeenCalled();
  });

  test("rejects an oversized token before reaching Auth", async () => {
    const deps = dependencies();
    await expect(
      signUpWithTurnstile({ ...input, turnstileToken: "t".repeat(2049) }, deps),
    ).resolves.toEqual({ code: "challenge", ok: false });
    expect(deps.signUp).not.toHaveBeenCalled();
  });

  test.each([
    ["a missing email", { email: "" }],
    ["an oversized email", { email: `${"a".repeat(320)}@example.test` }],
    ["a missing password", { password: "" }],
    ["a non-string token", { turnstileToken: 42 }],
  ])("rejects %s before reaching Auth", async (_label, override) => {
    const deps = dependencies();
    await expect(signUpWithTurnstile({ ...input, ...override }, deps)).resolves.toEqual({
      code: "challenge",
      ok: false,
    });
    expect(deps.signUp).not.toHaveBeenCalled();
  });

  test("hands the normalized credentials and the challenge token to Auth", async () => {
    const deps = dependencies();
    await expect(signUpWithTurnstile(input, deps)).resolves.toEqual({ code: "success", ok: true });
    expect(deps.signUp).toHaveBeenCalledWith({
      email: "person@example.test",
      options: { captchaToken: "valid-token" },
      password: "an-example-password",
    });
  });

  test("reports a rejected challenge as recoverable", async () => {
    const deps = dependencies();
    deps.signUp.mockResolvedValueOnce({ error: { message: "captcha protection: request disallowed" } });
    await expect(signUpWithTurnstile(input, deps)).resolves.toEqual({
      code: "challenge",
      ok: false,
    });
  });

  test("returns a bounded signup failure without echoing provider detail", async () => {
    const deps = dependencies();
    deps.signUp.mockResolvedValueOnce({ error: { message: "internal provider detail" } });
    await expect(signUpWithTurnstile(input, deps)).resolves.toEqual({ code: "signup", ok: false });
  });

  test("is configured only when the browser-visible site key is present", () => {
    expect(isSignupConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isSignupConfigured({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "  " } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isSignupConfigured({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});
