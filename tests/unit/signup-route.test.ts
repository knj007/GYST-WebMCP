import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signUpWithTurnstile: vi.fn() }));

vi.mock("@/lib/auth/signup", () => ({ signUpWithTurnstile: mocks.signUpWithTurnstile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

import { POST } from "@/app/api/auth/signup/route";

function request(body: string) {
  return new Request("https://gyst-web-mcp.vercel.app/api/auth/signup", {
    body,
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("signup route", () => {
  beforeEach(() => mocks.signUpWithTurnstile.mockReset());

  test.each(["null", "[]", '"not-an-object"', "{"])(
    "rejects JSON %s without reaching signup",
    async (body) => {
      const response = await POST(request(body));

      expect(response.status).toBe(400);
      expect(mocks.signUpWithTurnstile).not.toHaveBeenCalled();
    },
  );

  test("passes the submitted body to the signup service", async () => {
    mocks.signUpWithTurnstile.mockResolvedValueOnce({ code: "success", ok: true });
    const response = await POST(
      request(
        JSON.stringify({
          email: "person@example.test",
          password: "example-password",
          turnstileToken: "token",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.signUpWithTurnstile).toHaveBeenCalledWith(
      { email: "person@example.test", password: "example-password", turnstileToken: "token" },
      expect.any(Object),
    );
  });

  test.each([
    ["challenge", 400],
    ["signup", 400],
  ])("maps a %s result to status %i", async (code, status) => {
    mocks.signUpWithTurnstile.mockResolvedValueOnce({ code, ok: false });
    const response = await POST(request(JSON.stringify({ email: "a@b.test", password: "p", turnstileToken: "t" })));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
  });
});
