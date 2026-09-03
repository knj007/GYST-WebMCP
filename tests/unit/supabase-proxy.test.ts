import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), readSupabasePublicConfig: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getClaims: mocks.getClaims } })),
}));
vi.mock("@/lib/supabase/config", () => ({ readSupabasePublicConfig: mocks.readSupabasePublicConfig }));

import { config } from "@/proxy";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

function request(path: string) {
  return new NextRequest(new URL(path, "https://gyst-web-mcp.vercel.app"));
}

describe("session proxy protected prefixes", () => {
  beforeEach(() => {
    mocks.getClaims.mockReset();
    mocks.readSupabasePublicConfig.mockReset();
    mocks.readSupabasePublicConfig.mockReturnValue({ publishableKey: "sb_publishable_test", url: "https://example.supabase.co" });
    mocks.getClaims.mockResolvedValue({ data: null, error: { message: "no session" } });
  });

  test("matches every welcome page alongside the ritual pages", () => {
    expect(config.matcher).toEqual(["/daily/:path*", "/weekly/:path*", "/welcome/:path*", "/login"]);
  });

  test("sends an unauthenticated welcome visitor to login without deciding onboarding", async () => {
    for (const path of ["/welcome", "/welcome/goals", "/welcome/review", "/welcome/rhythm"]) {
      const response = await updateSupabaseSession(request(path));
      expect(response.headers.get("location")).toBe("https://gyst-web-mcp.vercel.app/login");
    }
  });

  test("keeps the configuration reason for a welcome page when Supabase is not configured", async () => {
    mocks.readSupabasePublicConfig.mockReturnValue(null);
    const response = await updateSupabaseSession(request("/welcome/goals"));
    expect(response.headers.get("location")).toBe("https://gyst-web-mcp.vercel.app/login?reason=configuration");
  });

  test("lets an authenticated identity through to the welcome pages, onboarded or not", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "a8000000-0000-4000-8000-000000000001" } }, error: null });
    const response = await updateSupabaseSession(request("/welcome"));
    expect(response.headers.get("location")).toBeNull();
  });

  test("still redirects a signed-in visitor away from login", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "a8000000-0000-4000-8000-000000000001" } }, error: null });
    const response = await updateSupabaseSession(request("/login"));
    expect(response.headers.get("location")).toBe("https://gyst-web-mcp.vercel.app/daily");
  });
});
