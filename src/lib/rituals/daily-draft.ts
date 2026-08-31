import type { Database } from "@/lib/db/database.types";

export type DailyDraft = {
  blocker_text: string | null;
  blocker_type: Database["public"]["Enums"]["blocker_type"] | null;
  buried_win: string | null;
  is_sensitive: boolean;
  moved_text: string | null;
  next_commitment_id: string | null;
  optional_context: string | null;
  previous_commitment_id: string | null;
  previous_commitment_outcome: Database["public"]["Enums"]["commitment_outcome"] | null;
};

const blockerTypes = new Set<DailyDraft["blocker_type"]>([
  "internal",
  "external_gate",
  "capacity",
  "clarity",
  "dependency",
  "other",
]);
const outcomes = new Set<DailyDraft["previous_commitment_outcome"]>([
  "done",
  "partial",
  "deferred",
  "not_done",
  "planned_skip",
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function valueAsText(formData: FormData, field: string, maximumLength: number): string | null {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maximumLength) {
    throw new Error("One of the draft fields is too long.");
  }

  return trimmed;
}

function valueAsUuid(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

function valueFromSet<T extends string>(formData: FormData, field: string, allowed: Set<T | null>): T | null {
  const value = formData.get(field);
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : null;
}

export function readDailyDraft(formData: FormData): DailyDraft {
  const blockerText = valueAsText(formData, "blocker_text", 8000);

  return {
    blocker_text: blockerText,
    blocker_type: blockerText ? valueFromSet(formData, "blocker_type", blockerTypes) : null,
    buried_win: valueAsText(formData, "buried_win", 4000),
    is_sensitive: formData.get("is_sensitive") === "on",
    moved_text: valueAsText(formData, "moved_text", 12000),
    next_commitment_id: valueAsUuid(formData, "next_commitment_id"),
    optional_context: valueAsText(formData, "optional_context", 12000),
    previous_commitment_id: valueAsUuid(formData, "previous_commitment_id"),
    previous_commitment_outcome: valueFromSet(formData, "previous_commitment_outcome", outcomes),
  };
}
