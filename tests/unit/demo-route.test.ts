import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ startDemoSession: vi.fn() }));

vi.mock("@/lib/demo/session", () => ({ startDemoSession: mocks.startDemoSession }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

import { POST } from "@/app/api/demo/start/route";

function request(body: string) {
  return new Request("https://gyst-web-mcp.vercel.app/api/demo/start", {
    body,
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("judge demo route", () => {
  beforeEach(() => mocks.startDemoSession.mockReset());

  test.each(["null", "[]", '"not-an-object"', "{"])(
    "rejects JSON %s without starting a demo session",
    async (body) => {
      const response = await POST(request(body));

      expect(response.status).toBe(400);
      expect(mocks.startDemoSession).not.toHaveBeenCalled();
    },
  );

  test("returns a ritual destination after the demo ledger is prepared", async () => {
    mocks.startDemoSession.mockResolvedValueOnce({ code: "success", ok: true });
    const response = await POST(request(JSON.stringify({ turnstileToken: "token" })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ redirectTo: "/daily", status: "success" });
    expect(mocks.startDemoSession).toHaveBeenCalledWith(
      { turnstileToken: "token" },
      expect.any(Object),
    );
  });

  test.each([
    ["challenge", 400],
    ["seed", 503],
    ["unavailable", 503],
  ])("maps a %s result to status %i without a destination", async (code, status) => {
    mocks.startDemoSession.mockResolvedValueOnce({ code, ok: false });
    const response = await POST(request(JSON.stringify({ turnstileToken: "token" })));

    expect(response.status).toBe(status);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.redirectTo).toBeUndefined();
    expect(payload.message).toEqual(expect.any(String));
  });
});
