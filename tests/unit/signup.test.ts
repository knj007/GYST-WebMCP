import { beforeEach, describe, expect, test, vi } from "vitest";

import { signUpWithVerifiedTurnstile } from "@/lib/auth/signup";

const input = {
  email: " person@example.test ",
  expectedHostname: "gyst-web-mcp.vercel.app",
  password: "an-example-password",
  turnstileToken: "valid-token",
};

function dependencies(response: Response | Error) {
  const signUp = vi.fn().mockResolvedValue({ error: null });
  return {
    createClient: vi.fn().mockResolvedValue({ auth: { signUp } }),
    fetch: vi.fn().mockImplementation(async () => {
      if (response instanceof Error) {
        throw response;
      }
      return response;
    }),
    secret: "server-only-test-secret",
    signUp,
  };
}

function siteverify(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("Turnstile-protected signup", () => {
  beforeEach(() => vi.restoreAllMocks());

  test("rejects a missing token before Siteverify or Auth", async () => {
    const deps = dependencies(siteverify({ success: true, hostname: input.expectedHostname }));
    await expect(signUpWithVerifiedTurnstile({ ...input, turnstileToken: "" }, deps)).resolves.toEqual({ code: "challenge", ok: false });
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.signUp).not.toHaveBeenCalled();
  });

  test.each([
    ["invalid", ["invalid-input-response"]],
    ["expired", ["timeout-or-duplicate"]],
    ["replayed", ["timeout-or-duplicate"]],
  ])("rejects a %s token before Auth signup", async (_name, errorCodes) => {
    const deps = dependencies(siteverify({ "error-codes": errorCodes, success: false }));
    await expect(signUpWithVerifiedTurnstile(input, deps)).resolves.toEqual({ code: "challenge", ok: false });
    expect(deps.signUp).not.toHaveBeenCalled();
  });

  test("rejects a token issued for another hostname", async () => {
    const deps = dependencies(siteverify({ hostname: "attacker.example", success: true }));
    await expect(signUpWithVerifiedTurnstile(input, deps)).resolves.toEqual({ code: "challenge", ok: false });
    expect(deps.signUp).not.toHaveBeenCalled();
  });

  test("fails closed when Siteverify is unavailable", async () => {
    const deps = dependencies(new Error("network unavailable"));
    await expect(signUpWithVerifiedTurnstile(input, deps)).resolves.toEqual({ code: "unavailable", ok: false });
    expect(deps.signUp).not.toHaveBeenCalled();
  });

  test("fails closed when the server-only secret is unavailable", async () => {
    const deps = dependencies(siteverify({ hostname: input.expectedHostname, success: true }));
    deps.secret = "";
    await expect(signUpWithVerifiedTurnstile(input, deps)).resolves.toEqual({ code: "configuration", ok: false });
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.signUp).not.toHaveBeenCalled();
  });

  test("calls Auth only after a valid hostname-bound verification", async () => {
    const deps = dependencies(siteverify({ hostname: input.expectedHostname, success: true }));
    await expect(signUpWithVerifiedTurnstile(input, deps)).resolves.toEqual({ code: "success", ok: true });
    expect(deps.signUp).toHaveBeenCalledWith({ email: "person@example.test", password: input.password });
  });

  test("returns a bounded signup failure after verified challenge", async () => {
    const deps = dependencies(siteverify({ hostname: input.expectedHostname, success: true }));
    deps.signUp.mockResolvedValueOnce({ error: { message: "internal provider detail" } });
    await expect(signUpWithVerifiedTurnstile(input, deps)).resolves.toEqual({ code: "signup", ok: false });
  });
});
