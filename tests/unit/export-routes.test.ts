import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createPortableExport: vi.fn(), createServerSupabaseClient: vi.fn(), requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/export/portable", () => ({ createMarkdownExport: vi.fn(() => "# archive\n"), createPortableExport: mocks.createPortableExport }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));

import { GET as jsonExport } from "@/app/api/exports/json/route";
import { GET as markdownExport } from "@/app/api/exports/markdown/route";

const ownerId = "11111111-1111-4111-8111-111111111111";

describe("export routes", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset().mockResolvedValue({ isDemo: false, userId: ownerId });
    mocks.createPortableExport.mockReset().mockResolvedValue({ format: "gyst-portable-v1", rituals: [] });
    mocks.createServerSupabaseClient.mockReset().mockResolvedValue({});
  });

  test("uses the current owner identity and excludes drafts by default", async () => {
    const response = await jsonExport(new NextRequest("https://gyst.test/api/exports/json"));
    expect(response.status).toBe(200);
    expect(mocks.createPortableExport).toHaveBeenCalledWith(expect.anything(), ownerId, false);
    await expect(response.json()).resolves.toEqual({ format: "gyst-portable-v1", rituals: [] });
  });

  test("includes drafts only when full_backup=1 is deliberately requested", async () => {
    await markdownExport(new NextRequest("https://gyst.test/api/exports/markdown?full_backup=1"));
    expect(mocks.createPortableExport).toHaveBeenCalledWith(expect.anything(), ownerId, true);
  });

  test("does not export data for a demo account", async () => {
    mocks.requireUser.mockResolvedValueOnce({ isDemo: true, userId: ownerId });
    const response = await jsonExport(new NextRequest("https://gyst.test/api/exports/json"));
    expect(response.status).toBe(403);
    expect(mocks.createPortableExport).not.toHaveBeenCalled();
  });
});
