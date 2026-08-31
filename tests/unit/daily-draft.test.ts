import { describe, expect, test } from "vitest";

import { readDailyDraft } from "@/lib/rituals/daily-draft";

function draftForm(fields: Record<string, string> = {}) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

describe("daily draft input", () => {
  test("normalizes optional paired fields and ignores unsupported enum values", () => {
    expect(
      readDailyDraft(
        draftForm({
          blocker_text: "  ",
          blocker_type: "not-a-type",
          previous_commitment_id: "not-a-uuid",
          previous_commitment_outcome: "not-an-outcome",
        }),
      ),
    ).toMatchObject({
      blocker_text: null,
      blocker_type: null,
      previous_commitment_id: null,
      previous_commitment_outcome: null,
    });
  });

  test("retains supported values and the sensitive flag", () => {
    expect(
      readDailyDraft(
        draftForm({
          blocker_text: "Waiting on approval",
          blocker_type: "external_gate",
          is_sensitive: "on",
          next_commitment_id: "c3000000-0000-4000-8000-000000000001",
          previous_commitment_id: "c3000000-0000-4000-8000-000000000002",
          previous_commitment_outcome: "partial",
        }),
      ),
    ).toMatchObject({
      blocker_text: "Waiting on approval",
      blocker_type: "external_gate",
      is_sensitive: true,
      next_commitment_id: "c3000000-0000-4000-8000-000000000001",
      previous_commitment_id: "c3000000-0000-4000-8000-000000000002",
      previous_commitment_outcome: "partial",
    });
  });

  test("rejects text over the database limit before writing", () => {
    expect(() => readDailyDraft(draftForm({ moved_text: "x".repeat(12001) }))).toThrow(
      "One of the draft fields is too long.",
    );
  });
});
