import { NextResponse } from "next/server";

import { saveOnboardingDraft } from "@/app/(welcome)/welcome/goals/actions";
import {
  type OnboardingCollection,
  type OnboardingDraft,
  emptyOnboardingDraft,
  normalizeArea,
  normalizeCommitment,
  normalizeGoal,
  normalizeKeyDate,
  onboardingDraftToFormData,
  onboardingLimits,
} from "@/lib/onboarding/draft";
import { getOnboardingRecord } from "@/lib/onboarding/record";
import { requireObject } from "@/lib/webmcp/contracts";

const idle = { message: "", status: "idle" } as const;

function draftUpdated(fields: OnboardingCollection[]) {
  return NextResponse.json({
    effect: `Replaced ${fields.join(", ")} in the visible onboarding draft. Nothing is committed; the owner reviews and commits the founding statement by hand.`,
    message: "Draft updated. It was not committed.",
    uncommitted: true as const,
    updated_fields: fields,
  });
}

function entries(value: unknown, collection: OnboardingCollection): unknown[] {
  const { max, min } = onboardingLimits[collection];
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`${collection} must contain between ${min} and ${max} entries.`);
  }
  return value;
}

function assertUnique(keys: string[], collection: OnboardingCollection) {
  if (keys.some((key) => !key)) throw new Error(`Every ${collection.replace("_", " ")} entry needs a key.`);
  if (new Set(keys).size !== keys.length) throw new Error(`${collection} keys must be unique.`);
}

function assertKnown(references: string[], known: Set<string>, field: string) {
  for (const reference of references) {
    if (!known.has(reference)) throw new Error(`${field} "${reference}" does not match a key in the current draft. Read the draft first.`);
  }
}

function withReplacement(draft: OnboardingDraft, action: unknown, input: unknown): { draft: OnboardingDraft; fields: OnboardingCollection[] } {
  const values = requireObject(input);
  switch (action) {
    case "propose_areas": {
      const areas = entries(values.areas, "areas").map((item, index) => normalizeArea(item, `area-${index + 1}`));
      assertUnique(areas.map((area) => area.key), "areas");
      if (areas.some((area) => !area.title)) throw new Error("Every area needs a title the owner stated.");
      return { draft: { ...draft, areas }, fields: ["areas"] };
    }
    case "propose_goals": {
      const goals = entries(values.goals, "goals").map((item, index) => normalizeGoal(item, `goal-${index + 1}`));
      assertUnique(goals.map((goal) => goal.key), "goals");
      if (goals.some((goal) => !goal.title)) throw new Error("Every goal needs a title the owner stated.");
      assertKnown(goals.map((goal) => goal.area_key), new Set(draft.areas.map((area) => area.key)), "area_key");
      return { draft: { ...draft, goals }, fields: ["goals"] };
    }
    case "propose_key_dates": {
      const keyDates = entries(values.key_dates, "key_dates").map((item) => normalizeKeyDate(item));
      if (keyDates.some((keyDate) => !keyDate.title || !keyDate.due_on)) throw new Error("Every key date needs a title and a due_on date the owner stated.");
      assertKnown(keyDates.map((keyDate) => keyDate.goal_key), new Set(draft.goals.map((goal) => goal.key)), "goal_key");
      return { draft: { ...draft, key_dates: keyDates }, fields: ["key_dates"] };
    }
    case "propose_first_commitments": {
      const commitments = entries(values.commitments, "commitments").map((item) => normalizeCommitment(item));
      if (commitments.some((commitment) => !commitment.title)) throw new Error("Every commitment needs a title the owner stated.");
      assertKnown(commitments.map((commitment) => commitment.goal_key), new Set(draft.goals.map((goal) => goal.key)), "goal_key");
      return { draft: { ...draft, commitments }, fields: ["commitments"] };
    }
    default:
      throw new Error("Unsupported onboarding draft tool.");
  }
}

export async function POST(request: Request) {
  try {
    const { action, input } = requireObject(await request.json());
    const { identity, record } = await getOnboardingRecord();
    if (identity.isDemo) throw new Error("The demo ledger is already prepared; onboarding tools are unavailable.");
    if (record?.status === "committed") throw new Error("The founding statement is already committed.");
    const current = record?.draft ?? emptyOnboardingDraft();
    const { draft, fields } = withReplacement(current, action, input);
    const result = await saveOnboardingDraft(idle, onboardingDraftToFormData(draft, record?.version ?? null));
    if (result.status === "error") throw new Error(result.message);
    return draftUpdated(fields);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update the onboarding draft." }, { status: 400 });
  }
}
