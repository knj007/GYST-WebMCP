import { beforeEach, describe, expect, test, vi } from "vitest";

import { isDemoConfigured, startDemoSession } from "@/lib/demo/session";

function dependencies() {
  const signInAnonymously = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  return {
    createClient: vi.fn().mockResolvedValue({ auth: { signInAnonymously }, rpc }),
    rpc,
    signInAnonymously,
  };
}

describe("judge demo session", () => {
  beforeEach(() => vi.restoreAllMocks());

  test.each([
    ["a missing token", ""],
    ["a whitespace token", "   "],
    ["a non-string token", 42],
    ["an oversized token", "t".repeat(2049)],
  ])("rejects %s before creating a demo identity", async (_label, turnstileToken) => {
    const deps = dependencies();
    await expect(startDemoSession({ turnstileToken }, deps)).resolves.toEqual({
      code: "challenge",
      ok: false,
    });
    expect(deps.createClient).not.toHaveBeenCalled();
    expect(deps.signInAnonymously).not.toHaveBeenCalled();
  });

  test("passes the challenge token to Supabase rather than verifying it locally", async () => {
    const deps = dependencies();
    await expect(startDemoSession({ turnstileToken: " demo-token " }, deps)).resolves.toEqual({
      code: "success",
      ok: true,
    });
    expect(deps.signInAnonymously).toHaveBeenCalledWith({
      options: { captchaToken: "demo-token" },
    });
  });

  test("seeds the fictional ledger only after the demo identity exists", async () => {
    const deps = dependencies();
    await startDemoSession({ turnstileToken: "demo-token" }, deps);
    expect(deps.rpc).toHaveBeenCalledWith("seed_demo_ledger");
    expect(deps.signInAnonymously.mock.invocationCallOrder[0]).toBeLessThan(
      deps.rpc.mock.invocationCallOrder[0]!,
    );
  });

  test("reports a rejected challenge as recoverable and never seeds", async () => {
    const deps = dependencies();
    deps.signInAnonymously.mockResolvedValueOnce({
      error: { message: "captcha protection: request disallowed" },
    });
    await expect(startDemoSession({ turnstileToken: "demo-token" }, deps)).resolves.toEqual({
      code: "challenge",
      ok: false,
    });
    expect(deps.rpc).not.toHaveBeenCalled();
  });

  test("reports any other sign-in failure as unavailable and never seeds", async () => {
    const deps = dependencies();
    deps.signInAnonymously.mockResolvedValueOnce({ error: { message: "anonymous sign-ins are disabled" } });
    await expect(startDemoSession({ turnstileToken: "demo-token" }, deps)).resolves.toEqual({
      code: "unavailable",
      ok: false,
    });
    expect(deps.rpc).not.toHaveBeenCalled();
  });

  test("reports a seeding failure separately from a sign-in failure", async () => {
    const deps = dependencies();
    deps.rpc.mockResolvedValueOnce({ error: { message: "seed failed" } });
    await expect(startDemoSession({ turnstileToken: "demo-token" }, deps)).resolves.toEqual({
      code: "seed",
      ok: false,
    });
  });

  test("is configured only when the browser-visible site key is present", () => {
    expect(isDemoConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isDemoConfigured({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});
