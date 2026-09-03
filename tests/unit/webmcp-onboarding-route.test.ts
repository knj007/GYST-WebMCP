import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getOnboardingRecord: vi.fn(), saveOnboardingDraft: vi.fn() }));

vi.mock("@/lib/onboarding/record", () => ({ getOnboardingRecord: mocks.getOnboardingRecord }));
vi.mock("@/app/(welcome)/welcome/goals/actions", () => ({ saveOnboardingDraft: mocks.saveOnboardingDraft }));

import { POST } from "@/app/api/webmcp/onboarding/route";

const existingDraft = {
  areas: [{ description: null, key: "studio", title: "Studio" }],
  commitments: [{ details: null, due_on: null, goal_key: "guide", title: "Draft chapter one" }],
  display_name: "Kai",
  goals: [{ area_key: "studio", description: null, key: "guide", priority: 4, target_date: null, title: "Publish the field guide" }],
  key_dates: [],
  timezone: "America/Chicago",
};

function request(action: string, input: Record<string, unknown>) {
  return new Request("https://gyst-web-mcp.vercel.app/api/webmcp/onboarding", {
    body: JSON.stringify({ action, input }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function submittedForm() {
  return mocks.saveOnboardingDraft.mock.calls[0]?.[1] as FormData;
}

describe("onboarding WebMCP route", () => {
  beforeEach(() => {
    mocks.getOnboardingRecord.mockReset();
    mocks.saveOnboardingDraft.mockReset();
    mocks.getOnboardingRecord.mockResolvedValue({
      identity: { isDemo: false, userId: "a8000000-0000-4000-8000-000000000001" },
      profile: null,
      record: { committed_at: null, draft: existingDraft, founding_commitment_id: null, id: "d3000000-0000-4000-8000-000000000001", status: "draft", version: 2 },
    });
    mocks.saveOnboardingDraft.mockResolvedValue({ status: "success" });
  });

  test("never references a commit or add-commitment RPC", () => {
    const route = readFileSync(join(process.cwd(), "src", "app", "api", "webmcp", "onboarding", "route.ts"), "utf8");
    const context = readFileSync(join(process.cwd(), "src", "app", "api", "webmcp", "context", "onboarding", "route.ts"), "utf8");
    for (const source of [route, context]) {
      expect(source).not.toContain("commit_onboarding");
      expect(source).not.toContain("add_commitment");
      expect(source).not.toContain("commitOnboarding");
    }
  });

  test("replaces only the proposed array, preserving the rest of the draft and its version", async () => {
    const response = await POST(request("propose_first_commitments", { commitments: [{ goal_key: "guide", title: "  Outline chapter two  ", due_on: "2026-09-09" }] }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ uncommitted: true, updated_fields: ["commitments"] });
    const form = submittedForm();
    expect(form.get("draft_version")).toBe("2");
    expect(form.get("display_name")).toBe("Kai");
    expect(form.get("timezone")).toBe("America/Chicago");
    expect(form.get("areas.0.key")).toBe("studio");
    expect(form.get("goals.0.key")).toBe("guide");
    expect(form.get("commitments.0.title")).toBe("Outline chapter two");
    expect(form.get("commitments.0.due_on")).toBe("2026-09-09");
    expect(form.has("commitments.1.title")).toBe(false);
  });

  test("keeps the agent's keys so later proposals can reference them", async () => {
    await POST(request("propose_areas", { areas: [{ key: "home", title: "Home" }, { key: "studio", title: "Studio" }] }));
    const form = submittedForm();
    expect(form.get("areas.0.key")).toBe("home");
    expect(form.get("areas.1.key")).toBe("studio");
  });

  test("rejects a goal that references an area key missing from the current draft", async () => {
    const response = await POST(request("propose_goals", { goals: [{ key: "g", area_key: "garden", title: "Grow", priority: 2 }] }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'area_key "garden" does not match a key in the current draft. Read the draft first.' });
    expect(mocks.saveOnboardingDraft).not.toHaveBeenCalled();
  });

  test("rejects duplicate keys, empty titles, and oversized lists before writing", async () => {
    for (const body of [
      request("propose_areas", { areas: [{ key: "a", title: "One" }, { key: "a", title: "Two" }] }),
      request("propose_areas", { areas: [{ key: "a", title: "   " }] }),
      request("propose_areas", { areas: [] }),
      request("propose_key_dates", { key_dates: [{ goal_key: "guide", title: "Review", kind: "review" }] }),
    ]) {
      const response = await POST(body);
      expect(response.status).toBe(400);
    }
    expect(mocks.saveOnboardingDraft).not.toHaveBeenCalled();
  });

  test("starts from an empty draft when none is saved yet", async () => {
    mocks.getOnboardingRecord.mockResolvedValueOnce({ identity: { isDemo: false }, profile: null, record: null });
    await POST(request("propose_areas", { areas: [{ key: "studio", title: "Studio" }] }));
    const form = submittedForm();
    expect(form.get("draft_version")).toBe("");
    expect(form.get("areas.0.title")).toBe("Studio");
  });

  test("refuses a committed draft, a demo session, and an unknown tool", async () => {
    mocks.getOnboardingRecord.mockResolvedValueOnce({ identity: { isDemo: false }, profile: null, record: { draft: existingDraft, status: "committed", version: 3 } });
    expect((await POST(request("propose_areas", { areas: [{ key: "a", title: "A" }] }))).status).toBe(400);

    mocks.getOnboardingRecord.mockResolvedValueOnce({ identity: { isDemo: true }, profile: null, record: null });
    expect((await POST(request("propose_areas", { areas: [{ key: "a", title: "A" }] }))).status).toBe(400);

    expect((await POST(request("commit_onboarding", {}))).status).toBe(400);
    expect(mocks.saveOnboardingDraft).not.toHaveBeenCalled();
  });

  test("surfaces the draft-save action's own error message", async () => {
    mocks.saveOnboardingDraft.mockResolvedValueOnce({ message: "The onboarding draft changed elsewhere. Refresh before saving.", status: "error" });
    const response = await POST(request("propose_areas", { areas: [{ key: "a", title: "A" }] }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "The onboarding draft changed elsewhere. Refresh before saving." });
  });
});
