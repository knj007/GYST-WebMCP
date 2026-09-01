import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDailyRitual: vi.fn(), saveDailyDraft: vi.fn() }));

vi.mock("@/lib/rituals/daily", () => ({ getDailyRitual: mocks.getDailyRitual }));
vi.mock("@/app/(ritual)/daily/actions", () => ({ saveDailyDraft: mocks.saveDailyDraft }));

import { POST } from "@/app/api/webmcp/daily/route";

function request(input: Record<string, unknown>) {
  return new Request("https://gyst-web-mcp.vercel.app/api/webmcp/daily", {
    body: JSON.stringify({ action: "record_optional_context", input }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("daily WebMCP route optional context", () => {
  beforeEach(() => {
    mocks.getDailyRitual.mockReset();
    mocks.saveDailyDraft.mockReset();
    mocks.getDailyRitual.mockResolvedValue({
      entry: { buried_win: "Kept a promise", is_sensitive: false, optional_context: "Existing context" },
      periodStart: "2026-09-01",
      session: { status: "draft", version: 1 },
    });
    mocks.saveDailyDraft.mockResolvedValue({ status: "success" });
  });

  test("preserves omitted optional text fields and only reports the field the agent updated", async () => {
    const response = await POST(request({ is_sensitive: true }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ uncommitted: true, updated_fields: ["is_sensitive"] });
    const form = mocks.saveDailyDraft.mock.calls[0]?.[1] as FormData;
    expect(form.get("buried_win")).toBe("Kept a promise");
    expect(form.get("optional_context")).toBe("Existing context");
    expect(form.get("is_sensitive")).toBe("on");
  });

  test("reports and clears only an explicitly supplied optional text field", async () => {
    const response = await POST(request({ optional_context: "" }));

    await expect(response.json()).resolves.toMatchObject({ updated_fields: ["optional_context"] });
    const form = mocks.saveDailyDraft.mock.calls[0]?.[1] as FormData;
    expect(form.get("buried_win")).toBe("Kept a promise");
    expect(form.has("optional_context")).toBe(false);
  });
});
