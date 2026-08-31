import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verifyOtp: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { verifyOtp: mocks.verifyOtp } })),
}));

import { GET } from "@/app/auth/confirm/route";

describe("email confirmation callback", () => {
  beforeEach(() => mocks.verifyOtp.mockReset());

  test("rejects a missing confirmation token without reaching Supabase", async () => {
    const response = await GET(new Request("https://gyst-web-mcp.vercel.app/auth/confirm?type=email"));
    expect(response.headers.get("location")).toBe("https://gyst-web-mcp.vercel.app/login?error=confirmation");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  test("rejects an unexpected confirmation type", async () => {
    const response = await GET(new Request("https://gyst-web-mcp.vercel.app/auth/confirm?token_hash=token&type=recovery"));
    expect(response.headers.get("location")).toBe("https://gyst-web-mcp.vercel.app/login?error=confirmation");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  test("returns to login when Supabase rejects the token", async () => {
    mocks.verifyOtp.mockResolvedValueOnce({ error: { message: "expired" } });
    const response = await GET(new Request("https://gyst-web-mcp.vercel.app/auth/confirm?token_hash=token&type=email"));
    expect(response.headers.get("location")).toBe("https://gyst-web-mcp.vercel.app/login?error=confirmation");
  });

  test("exchanges a valid email token and redirects into the ritual", async () => {
    mocks.verifyOtp.mockResolvedValueOnce({ error: null });
    const response = await GET(new Request("https://gyst-web-mcp.vercel.app/auth/confirm?token_hash=token&type=email"));
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "token", type: "email" });
    expect(response.headers.get("location")).toBe("https://gyst-web-mcp.vercel.app/daily");
  });
});
