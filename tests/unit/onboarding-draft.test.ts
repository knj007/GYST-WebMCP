import { describe, expect, test } from "vitest";

import {
  type OnboardingDraft,
  onboardingDraftToFormData,
  parseOnboardingDraft,
  readOnboardingDraft,
  readOnboardingDraftVersion,
} from "@/lib/onboarding/draft";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const fullDraft: OnboardingDraft = {
  areas: [{ description: "Everything the studio ships", key: "studio", title: "Studio" }],
  commitments: [{ details: null, due_on: "2026-09-05", goal_key: "guide", title: "Draft chapter one" }],
  display_name: "Kai",
  goals: [{ area_key: "studio", description: "It is the flagship", key: "guide", priority: 5, target_date: "2026-12-01", title: "Publish the field guide" }],
  key_dates: [{ due_on: "2026-10-15", goal_key: "guide", kind: "review", notes: null, title: "Editorial review" }],
  timezone: "America/Chicago",
};

describe("onboarding draft form mapping", () => {
  test("maps indexed row fields into the draft JSON, trimming text and keeping keys", () => {
    const draft = readOnboardingDraft(form({
      "areas.0.description": "  ",
      "areas.0.key": "studio",
      "areas.0.title": "  Studio  ",
      "commitments.0.goal_key": "guide",
      "commitments.0.title": " Draft chapter one ",
      display_name: "  Kai ",
      "goals.0.area_key": "studio",
      "goals.0.description": " It is the flagship ",
      "goals.0.key": "guide",
      "goals.0.priority": "5",
      "goals.0.target_date": "2026-12-01",
      "goals.0.title": "Publish the field guide",
      "key_dates.0.due_on": "2026-10-15",
      "key_dates.0.goal_key": "guide",
      "key_dates.0.kind": "review",
      "key_dates.0.title": "Editorial review",
      timezone: "America/Chicago",
    }));

    expect(draft).toEqual({
      areas: [{ description: null, key: "studio", title: "Studio" }],
      commitments: [{ details: null, due_on: null, goal_key: "guide", title: "Draft chapter one" }],
      display_name: "Kai",
      goals: [{ area_key: "studio", description: "It is the flagship", key: "guide", priority: 5, target_date: "2026-12-01", title: "Publish the field guide" }],
      key_dates: [{ due_on: "2026-10-15", goal_key: "guide", kind: "review", notes: null, title: "Editorial review" }],
      timezone: "America/Chicago",
    });
  });

  test("orders rows by index even when indexes are sparse, and never lowercases the timezone", () => {
    const draft = readOnboardingDraft(form({
      "areas.5.key": "second",
      "areas.5.title": "Second",
      "areas.2.key": "first",
      "areas.2.title": "First",
      timezone: "Europe/London",
    }));
    expect(draft.areas.map((area) => area.key)).toEqual(["first", "second"]);
    expect(draft.timezone).toBe("Europe/London");
  });

  test("round-trips JSON to form and back with every key unchanged", () => {
    const formData = onboardingDraftToFormData(fullDraft, 3);
    expect(formData.get("draft_version")).toBe("3");
    expect(formData.get("areas.0.key")).toBe("studio");
    expect(formData.get("goals.0.key")).toBe("guide");
    expect(formData.get("goals.0.area_key")).toBe("studio");
    expect(readOnboardingDraft(formData)).toEqual(fullDraft);
  });

  test("assigns positional keys only when a row arrives without one", () => {
    const draft = readOnboardingDraft(form({ "areas.0.title": "Studio", "goals.0.area_key": "area-1", "goals.0.title": "Ship" }));
    expect(draft.areas[0]?.key).toBe("area-1");
    expect(draft.goals[0]?.key).toBe("goal-1");
  });

  test("refuses shapes the database would refuse", () => {
    expect(() => readOnboardingDraft(form({ "goals.0.priority": "7", "goals.0.title": "x" }))).toThrow("goal priority must be a whole number from 1 to 5.");
    expect(() => readOnboardingDraft(form({ "key_dates.0.kind": "party", "key_dates.0.title": "x" }))).toThrow("key date kind must be deadline, milestone, event, or review.");
    expect(() => readOnboardingDraft(form({ "commitments.0.due_on": "next week", "commitments.0.title": "x" }))).toThrow("commitment due_on must be a YYYY-MM-DD date.");
    expect(() => readOnboardingDraft(form({ "areas.0.key": "same", "areas.0.title": "a", "areas.1.key": "same", "areas.1.title": "b" }))).toThrow("areas keys must be unique.");
    expect(() => readOnboardingDraft(form({ "areas.0.title": "x".repeat(161) }))).toThrow("area title must be at most 160 characters.");
  });

  test("parses stored JSON tolerantly, dropping unknown fields and defaulting priority", () => {
    const draft = parseOnboardingDraft({
      areas: [{ key: "a", title: "Area", unexpected: true }],
      goals: [{ area_key: "a", key: "g", title: "Goal" }],
      key_dates: null,
      timezone: "UTC",
    });
    expect(draft).toEqual({
      areas: [{ description: null, key: "a", title: "Area" }],
      commitments: [],
      display_name: null,
      goals: [{ area_key: "a", description: null, key: "g", priority: 3, target_date: null, title: "Goal" }],
      key_dates: [],
      timezone: "UTC",
    });
    expect(parseOnboardingDraft(null)).toEqual({ areas: [], commitments: [], display_name: null, goals: [], key_dates: [], timezone: null });
  });

  test("reads the expected draft version like the daily session version", () => {
    expect(readOnboardingDraftVersion(form({}))).toBeNull();
    expect(readOnboardingDraftVersion(form({ draft_version: "" }))).toBeNull();
    expect(readOnboardingDraftVersion(form({ draft_version: "4" }))).toBe(4);
    expect(() => readOnboardingDraftVersion(form({ draft_version: "zero" }))).toThrow("The onboarding draft version is invalid. Refresh before saving.");
  });
});
