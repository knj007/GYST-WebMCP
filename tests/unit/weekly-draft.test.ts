import { describe, expect, test } from "vitest";

import { readWeeklyDraft } from "@/lib/rituals/weekly-draft";

function weeklyForm(fields: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

describe("weekly draft input", () => {
  test("turns bounded line fields into structured draft data", () => {
    expect(readWeeklyDraft(weeklyForm({
      arrow: "up",
      decision_text: "  Protect the launch window. ",
      missing_metrics: "Conversion rate\nCycle time",
      observations: "The review cadence helped.",
      priorities: "Publish fictional guide | 2026-09-07\nReview fictional guide | 2026-09-09",
    }))).toEqual({
      arrow: "up",
      decision_text: "Protect the launch window.",
      missing_metrics: ["Conversion rate", "Cycle time"],
      observations: ["The review cadence helped."],
      priorities: [
        { due_on: "2026-09-07", title: "Publish fictional guide" },
        { due_on: "2026-09-09", title: "Review fictional guide" },
      ],
    });
  });

  test("rejects an undated or malformed priority before writing", () => {
    expect(() => readWeeklyDraft(weeklyForm({ priorities: "Publish guide" }))).toThrow("Each priority must use");
    expect(() => readWeeklyDraft(weeklyForm({ priorities: "Publish guide | soon" }))).toThrow("Each priority must use");
  });
});
