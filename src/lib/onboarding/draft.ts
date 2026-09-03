// The onboarding draft: one jsonb staging record fanned out by
// `commit_onboarding`. Field names are fixed by the migration; keys are
// client-side handles used only to resolve relations at commit and never
// stored as ledger identity.

export const keyDateKinds = ["deadline", "milestone", "event", "review"] as const;
export type KeyDateKind = (typeof keyDateKinds)[number];

export type OnboardingArea = { description: string | null; key: string; title: string };
export type OnboardingGoal = {
  area_key: string;
  description: string | null;
  key: string;
  priority: number;
  target_date: string | null;
  title: string;
};
export type OnboardingKeyDate = {
  due_on: string | null;
  goal_key: string;
  kind: KeyDateKind;
  notes: string | null;
  title: string;
};
export type OnboardingCommitment = { details: string | null; due_on: string | null; goal_key: string; title: string };

export type OnboardingDraft = {
  areas: OnboardingArea[];
  commitments: OnboardingCommitment[];
  display_name: string | null;
  goals: OnboardingGoal[];
  key_dates: OnboardingKeyDate[];
  timezone: string | null;
};

export type OnboardingCollection = "areas" | "commitments" | "goals" | "key_dates";

export const onboardingLimits = {
  areas: { max: 8, min: 1 },
  commitments: { max: 12, min: 1 },
  goals: { max: 12, min: 1 },
  key_dates: { max: 24, min: 0 },
  text: {
    area_description: 4000,
    area_title: 160,
    commitment_details: 8000,
    commitment_title: 500,
    display_name: 120,
    goal_description: 8000,
    goal_title: 240,
    key: 120,
    key_date_notes: 8000,
    key_date_title: 240,
    timezone: 100,
  },
} as const;

// Shared with agents through the onboarding context so the shapes are never
// guessed. Keys are supplied by whoever proposes an entry.
export const onboardingDraftContract = {
  areas: { fields: { description: "string | null", key: "string (unique handle)", title: "string" }, max: 8, min: 1 },
  commitments: { fields: { details: "string | null", due_on: "YYYY-MM-DD | null", goal_key: "key of a goal in this draft", title: "string" }, max: 12, min: 1 },
  display_name: "string | null",
  goals: { fields: { area_key: "key of an area in this draft", description: "string | null (the why)", key: "string (unique handle)", priority: "integer 1..5 (5 matters most)", target_date: "YYYY-MM-DD | null", title: "string" }, max: 12, min: 1 },
  key_dates: { fields: { due_on: "YYYY-MM-DD", goal_key: "key of a goal in this draft", kind: keyDateKinds.join(" | "), notes: "string | null", title: "string" }, max: 24, min: 0 },
  keys: "Keys are short handles unique within their array, supplied with each entry; relations resolve by key at commit and keys are never stored.",
  timezone: "exact IANA time zone name, e.g. America/Chicago",
} as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const rowFieldPattern = /^(areas|goals|key_dates|commitments)\.(\d+)\.([a-z_]+)$/;

export function emptyOnboardingDraft(): OnboardingDraft {
  return { areas: [], commitments: [], display_name: null, goals: [], key_dates: [], timezone: null };
}

function textOrNull(value: unknown, maximum: number, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > maximum) throw new Error(`${field} must be at most ${maximum} characters.`);
  return trimmed || null;
}

function dateOrNull(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !datePattern.test(value.trim())) throw new Error(`${field} must be a YYYY-MM-DD date.`);
  return value.trim();
}

function priorityValue(value: unknown): number {
  const priority = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof priority !== "number" || !Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw new Error("goal priority must be a whole number from 1 to 5.");
  }
  return priority;
}

function kindValue(value: unknown): KeyDateKind {
  if (typeof value !== "string" || !keyDateKinds.includes(value as KeyDateKind)) {
    throw new Error("key date kind must be deadline, milestone, event, or review.");
  }
  return value as KeyDateKind;
}

function keyValue(value: unknown, fallback: string): string {
  const key = textOrNull(value, onboardingLimits.text.key, "key");
  return key ?? fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function assertUniqueKeys(keys: string[], collection: "areas" | "goals") {
  if (new Set(keys).size !== keys.length) throw new Error(`${collection} keys must be unique.`);
}

// Entry normalizers. Each trims text, turns empty optional text into null, and
// rejects a shape the database would reject, in the same words where possible.
export function normalizeArea(input: unknown, fallbackKey: string): OnboardingArea {
  const raw = record(input);
  return {
    description: textOrNull(raw.description, onboardingLimits.text.area_description, "area description"),
    key: keyValue(raw.key, fallbackKey),
    title: textOrNull(raw.title, onboardingLimits.text.area_title, "area title") ?? "",
  };
}

export function normalizeGoal(input: unknown, fallbackKey: string): OnboardingGoal {
  const raw = record(input);
  return {
    area_key: textOrNull(raw.area_key, onboardingLimits.text.key, "goal area_key") ?? "",
    description: textOrNull(raw.description, onboardingLimits.text.goal_description, "goal description"),
    key: keyValue(raw.key, fallbackKey),
    priority: raw.priority === undefined || raw.priority === null || raw.priority === "" ? 3 : priorityValue(raw.priority),
    target_date: dateOrNull(raw.target_date, "goal target_date"),
    title: textOrNull(raw.title, onboardingLimits.text.goal_title, "goal title") ?? "",
  };
}

export function normalizeKeyDate(input: unknown): OnboardingKeyDate {
  const raw = record(input);
  return {
    due_on: dateOrNull(raw.due_on, "key date due_on"),
    goal_key: textOrNull(raw.goal_key, onboardingLimits.text.key, "key date goal_key") ?? "",
    kind: raw.kind === undefined || raw.kind === null || raw.kind === "" ? "milestone" : kindValue(raw.kind),
    notes: textOrNull(raw.notes, onboardingLimits.text.key_date_notes, "key date notes"),
    title: textOrNull(raw.title, onboardingLimits.text.key_date_title, "key date title") ?? "",
  };
}

export function normalizeCommitment(input: unknown): OnboardingCommitment {
  const raw = record(input);
  return {
    details: textOrNull(raw.details, onboardingLimits.text.commitment_details, "commitment details"),
    due_on: dateOrNull(raw.due_on, "commitment due_on"),
    goal_key: textOrNull(raw.goal_key, onboardingLimits.text.key, "commitment goal_key") ?? "",
    title: textOrNull(raw.title, onboardingLimits.text.commitment_title, "commitment title") ?? "",
  };
}

function normalizeList<T>(value: unknown, normalize: (item: unknown, index: number) => T): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("A draft collection must be an array.");
  return value.map((item, index) => normalize(item, index));
}

/**
 * Turn stored or proposed JSON into a typed draft. Unknown fields are dropped,
 * text is trimmed, missing keys receive positional handles, and duplicate area
 * or goal keys are refused because relations could not resolve.
 */
export function parseOnboardingDraft(value: unknown): OnboardingDraft {
  const raw = record(value);
  const draft: OnboardingDraft = {
    areas: normalizeList(raw.areas, (item, index) => normalizeArea(item, `area-${index + 1}`)),
    commitments: normalizeList(raw.commitments, (item) => normalizeCommitment(item)),
    display_name: textOrNull(raw.display_name, onboardingLimits.text.display_name, "display_name"),
    goals: normalizeList(raw.goals, (item, index) => normalizeGoal(item, `goal-${index + 1}`)),
    key_dates: normalizeList(raw.key_dates, (item) => normalizeKeyDate(item)),
    timezone: textOrNull(raw.timezone, onboardingLimits.text.timezone, "timezone"),
  };
  assertUniqueKeys(draft.areas.map((area) => area.key), "areas");
  assertUniqueKeys(draft.goals.map((goal) => goal.key), "goals");
  return draft;
}

/**
 * Form -> JSON. Rows are submitted as `<collection>.<index>.<field>`; the index
 * only orders rows, and the row's own hidden `key` field carries its handle so
 * a key survives every save and rehydration unchanged.
 */
export function readOnboardingDraft(formData: FormData): OnboardingDraft {
  const rows: Record<OnboardingCollection, Map<number, Record<string, string>>> = {
    areas: new Map(), commitments: new Map(), goals: new Map(), key_dates: new Map(),
  };
  for (const [name, value] of formData.entries()) {
    const match = name.match(rowFieldPattern);
    if (!match || typeof value !== "string") continue;
    const collection = match[1] as OnboardingCollection;
    const index = Number(match[2]);
    const field = match[3] as string;
    const row = rows[collection].get(index) ?? {};
    row[field] = value;
    rows[collection].set(index, row);
  }
  const ordered = (collection: OnboardingCollection) => [...rows[collection].entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
  const displayName = formData.get("display_name");
  const timezone = formData.get("timezone");
  return parseOnboardingDraft({
    areas: ordered("areas"),
    commitments: ordered("commitments"),
    display_name: typeof displayName === "string" ? displayName : null,
    goals: ordered("goals"),
    key_dates: ordered("key_dates"),
    timezone: typeof timezone === "string" ? timezone : null,
  });
}

/** JSON -> form, the inverse of `readOnboardingDraft`. */
export function onboardingDraftToFormData(draft: OnboardingDraft, version: number | null): FormData {
  const form = new FormData();
  form.set("draft_version", version === null ? "" : String(version));
  if (draft.display_name) form.set("display_name", draft.display_name);
  if (draft.timezone) form.set("timezone", draft.timezone);
  const collections: Array<[OnboardingCollection, Array<Record<string, string | number | null>>]> = [
    ["areas", draft.areas], ["goals", draft.goals], ["key_dates", draft.key_dates], ["commitments", draft.commitments],
  ];
  for (const [collection, entries] of collections) {
    entries.forEach((entry, index) => {
      for (const [field, value] of Object.entries(entry)) {
        if (value !== null && value !== undefined) form.set(`${collection}.${index}.${field}`, String(value));
      }
    });
  }
  return form;
}

export function readOnboardingDraftVersion(formData: FormData): number | null {
  const value = formData.get("draft_version");
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("The onboarding draft version is invalid. Refresh before saving.");
  }
  return Number(value);
}
