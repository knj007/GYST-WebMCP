import { beforeEach, describe, expect, test, vi } from "vitest";
import { isSignupConfigured, signUpWithTurnstile } from "@/lib/auth/signup";
const input = { email: " person@example.test ", password: "an-example-password", turnstileToken: "valid-token" };
function dependencies() { const signUp = vi.fn().mockResolvedValue({ data: { user: null }, error: null }); return { createClient: vi.fn().mockResolvedValue({ auth: { signUp } }), signUp }; }
describe("Turnstile-protected signup", () => {
  beforeEach(() => vi.restoreAllMocks());
  test("rejects invalid inputs before Auth", async () => { const deps = dependencies(); await expect(signUpWithTurnstile({ ...input, turnstileToken: "" }, deps)).resolves.toEqual({ code: "challenge", ok: false }); expect(deps.signUp).not.toHaveBeenCalled(); });
  test("normalizes credentials and passes the challenge token", async () => { const deps = dependencies(); await expect(signUpWithTurnstile(input, deps)).resolves.toEqual({ code: "success", ok: true }); expect(deps.signUp).toHaveBeenCalledWith({ email: "person@example.test", options: { captchaToken: "valid-token" }, password: input.password }); });
  test("maps Auth errors to bounded results", async () => { const deps = dependencies(); deps.signUp.mockResolvedValueOnce({ data: { user: null }, error: { message: "captcha protection" } }); await expect(signUpWithTurnstile(input, deps)).resolves.toEqual({ code: "challenge", ok: false }); deps.signUp.mockResolvedValueOnce({ data: { user: null }, error: { message: "provider detail" } }); await expect(signUpWithTurnstile(input, deps)).resolves.toEqual({ code: "signup", ok: false }); });
  test("detects browser configuration", () => { expect(isSignupConfigured({} as NodeJS.ProcessEnv)).toBe(false); expect(isSignupConfigured({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key" } as unknown as NodeJS.ProcessEnv)).toBe(true); });
});
