import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signUpWithVerifiedTurnstile: vi.fn() }));

vi.mock("@/lib/auth/signup", () => ({ signUpWithVerifiedTurnstile: mocks.signUpWithVerifiedTurnstile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

import { POST } from "@/app/api/auth/signup/route";

describe("signup route", () => {
  beforeEach(() => mocks.signUpWithVerifiedTurnstile.mockReset());

  test.each(["null", "[]", '"not-an-object"'])("rejects JSON %s without reaching signup", async (body) => {
    const response = await POST(new Request("https://gyst-web-mcp.vercel.app/api/auth/signup", {
      body,
      headers: { "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    expect(mocks.signUpWithVerifiedTurnstile).not.toHaveBeenCalled();
  });

  test("passes the request hostname and body to the verified signup service", async () => {
    mocks.signUpWithVerifiedTurnstile.mockResolvedValueOnce({ ok: true, code: "success" });
    const response = await POST(new Request("https://gyst-web-mcp.vercel.app/api/auth/signup", {
      body: JSON.stringify({ email: "person@example.test", password: "example-password", turnstileToken: "token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(mocks.signUpWithVerifiedTurnstile).toHaveBeenCalledWith(expect.objectContaining({ expectedHostname: "gyst-web-mcp.vercel.app" }), expect.any(Object));
  });
});
