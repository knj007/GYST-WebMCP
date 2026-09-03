"use client";

import { type Dispatch, type SetStateAction, useActionState, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { type OnboardingDraftActionState, saveOnboardingDraft } from "@/app/(welcome)/welcome/goals/actions";
import {
  type OnboardingArea,
  type OnboardingCommitment,
  type OnboardingDraft,
  type OnboardingGoal,
  type OnboardingKeyDate,
  keyDateKinds,
  onboardingLimits,
} from "@/lib/onboarding/draft";
import { useAgentDraftFields } from "@/lib/webmcp/draft-provenance";

const initialState: OnboardingDraftActionState = { message: "", status: "idle" };
const field = "mt-1 w-full rounded-xl border border-line bg-background p-3";
const labelClass = "block text-sm font-semibold";

type OnboardingDraftFormProps = { draft: OnboardingDraft; draftKey: string; draftVersion: number | null };

function newKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Browser-only values, read through useSyncExternalStore so the server render
// (no zones, no default) never disagrees with hydration and no effect has to
// set state afterwards. Snapshots are cached because they must be stable.
const noZones: string[] = [];
let cachedZones: string[] | null = null;
let cachedBrowserZone: string | null = null;
const subscribeToNothing = () => () => undefined;

function supportedTimeZones(): string[] {
  if (cachedZones) return cachedZones;
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
    cachedZones = typeof intl.supportedValuesOf === "function" ? intl.supportedValuesOf("timeZone") : noZones;
  } catch {
    cachedZones = noZones;
  }
  return cachedZones;
}

function browserTimeZone(): string {
  if (cachedBrowserZone !== null) return cachedBrowserZone;
  try {
    cachedBrowserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    cachedBrowserZone = "UTC";
  }
  return cachedBrowserZone;
}

// Rows keep the key they were born with: a hydrated row keeps its stored key,
// a new row receives one here, and the hidden input carries it back on save.
type Rows<T> = Array<T & { key: string }>;

export function OnboardingDraftForm({ draft, draftKey, draftVersion }: OnboardingDraftFormProps) {
  const [state, action, pending] = useActionState(saveOnboardingDraft, initialState);
  const provenance = useAgentDraftFields(`onboarding:${draftKey}`);
  const [displayName, setDisplayName] = useState(draft.display_name ?? "");
  const [chosenTimezone, setTimezone] = useState(draft.timezone ?? "");
  const timeZones = useSyncExternalStore(subscribeToNothing, supportedTimeZones, () => noZones);
  const defaultTimezone = useSyncExternalStore(subscribeToNothing, browserTimeZone, () => "");
  // The browser zone is the default until the owner chooses; it is sent
  // unmodified, as the exact IANA name the database expects.
  const timezone = chosenTimezone || defaultTimezone;
  const [areas, setAreas] = useState<Rows<OnboardingArea>>(draft.areas);
  const [goals, setGoals] = useState<Rows<OnboardingGoal>>(draft.goals);
  // Key dates and commitments carry no stored key, so hydrated rows take a
  // positional one: the server and client must render identical ids. Rows
  // added by a click are client-only and may take a random key.
  const [keyDates, setKeyDates] = useState<Rows<OnboardingKeyDate>>(draft.key_dates.map((keyDate, index) => ({ ...keyDate, key: `saved-key-date-${index + 1}` })));
  const [commitments, setCommitments] = useState<Rows<OnboardingCommitment>>(draft.commitments.map((commitment, index) => ({ ...commitment, key: `saved-commitment-${index + 1}` })));
  const version = state.version ?? draftVersion;
  const hasSavedDraft = version !== null;

  const marker = (name: string) => provenance.agentUpdated(name) ? <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Agent updated — review</span> : null;
  const zoneOptions = timeZones.length && timezone && !timeZones.includes(timezone) ? [timezone, ...timeZones] : timeZones;

  function update<T extends { key: string }>(setRows: Dispatch<SetStateAction<T[]>>, key: string, patch: Partial<T>, collection: string) {
    provenance.clearHumanEdit(collection);
    setRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }
  function remove<T extends { key: string }>(setRows: Dispatch<SetStateAction<T[]>>, key: string, collection: string) {
    provenance.clearHumanEdit(collection);
    setRows((rows) => rows.filter((row) => row.key !== key));
  }

  return (
    <form action={action} className="mt-8 space-y-10">
      <input name="draft_version" type="hidden" value={version ?? ""} />
      {provenance.fields.size ? <aside className="rounded-xl border border-accent bg-accent-soft p-4 text-sm" aria-live="polite"><p className="font-semibold">Review agent draft changes before continuing</p><p className="mt-1 text-muted">Marked groups were updated by an agent in this tab. Edit a group to take it back into your own review.</p></aside> : null}
      <fieldset className="space-y-10" disabled={pending}>
        <section aria-labelledby="onboarding-profile" className="space-y-4">
          <h2 className="text-xl font-semibold" id="onboarding-profile">About you</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="display_name">Name <span className="font-normal text-muted">Optional</span></label>
              <input className={field} id="display_name" maxLength={onboardingLimits.text.display_name} name="display_name" onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
            </div>
            <div>
              <label className={labelClass} htmlFor="timezone">Time zone</label>
              {zoneOptions.length ? (
                <select className={field} id="timezone" name="timezone" onChange={(event) => setTimezone(event.target.value)} required value={timezone}>
                  {zoneOptions.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              ) : (
                <input className={field} id="timezone" maxLength={onboardingLimits.text.timezone} name="timezone" onChange={(event) => setTimezone(event.target.value)} placeholder="America/Chicago" required value={timezone} />
              )}
              <p className="mt-1 text-xs text-muted">Decides which calendar day each daily ritual belongs to. Use the exact IANA name.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="onboarding-areas" className="space-y-4">
          <h2 className="text-xl font-semibold" id="onboarding-areas">Areas{marker("areas")}</h2>
          <p className="text-sm leading-6 text-muted">The parts of your life or work this ledger should hold. One to eight.</p>
          {areas.map((area, index) => (
            <div className="rounded-xl border border-line bg-background p-4" key={area.key}>
              <input name={`areas.${index}.key`} type="hidden" value={area.key} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor={`area-title-${area.key}`}>Area</label>
                  <input className={`${field} bg-surface`} id={`area-title-${area.key}`} maxLength={onboardingLimits.text.area_title} name={`areas.${index}.title`} onChange={(event) => update(setAreas, area.key, { title: event.target.value }, "areas")} required value={area.title} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`area-description-${area.key}`}>What it covers <span className="font-normal text-muted">Optional</span></label>
                  <input className={`${field} bg-surface`} id={`area-description-${area.key}`} maxLength={onboardingLimits.text.area_description} name={`areas.${index}.description`} onChange={(event) => update(setAreas, area.key, { description: event.target.value }, "areas")} value={area.description ?? ""} />
                </div>
              </div>
              <button className="mt-3 text-sm text-muted underline" onClick={() => remove(setAreas, area.key, "areas")} type="button">Remove area</button>
            </div>
          ))}
          <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={areas.length >= onboardingLimits.areas.max} onClick={() => setAreas((rows) => [...rows, { description: null, key: newKey(), title: "" }])} type="button">Add area</button>
        </section>

        <section aria-labelledby="onboarding-goals" className="space-y-4">
          <h2 className="text-xl font-semibold" id="onboarding-goals">Goals{marker("goals")}</h2>
          <p className="text-sm leading-6 text-muted">What you are working toward inside each area, why it matters, when it is due, and how much it matters. One to twelve.</p>
          {goals.map((goal, index) => (
            <div className="rounded-xl border border-line bg-background p-4" key={goal.key}>
              <input name={`goals.${index}.key`} type="hidden" value={goal.key} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor={`goal-title-${goal.key}`}>Goal</label>
                  <input className={`${field} bg-surface`} id={`goal-title-${goal.key}`} maxLength={onboardingLimits.text.goal_title} name={`goals.${index}.title`} onChange={(event) => update(setGoals, goal.key, { title: event.target.value }, "goals")} required value={goal.title} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`goal-area-${goal.key}`}>Area</label>
                  <select className={`${field} bg-surface`} id={`goal-area-${goal.key}`} name={`goals.${index}.area_key`} onChange={(event) => update(setGoals, goal.key, { area_key: event.target.value }, "goals")} required value={goal.area_key}>
                    <option value="">Choose an area</option>
                    {areas.map((area) => <option key={area.key} value={area.key}>{area.title || "Untitled area"}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor={`goal-description-${goal.key}`}>Why it matters <span className="font-normal text-muted">Optional</span></label>
                  <textarea className={`${field} min-h-20 bg-surface`} id={`goal-description-${goal.key}`} maxLength={onboardingLimits.text.goal_description} name={`goals.${index}.description`} onChange={(event) => update(setGoals, goal.key, { description: event.target.value }, "goals")} value={goal.description ?? ""} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`goal-target-${goal.key}`}>Due date <span className="font-normal text-muted">Optional</span></label>
                  <input className={`${field} bg-surface`} id={`goal-target-${goal.key}`} name={`goals.${index}.target_date`} onChange={(event) => update(setGoals, goal.key, { target_date: event.target.value || null }, "goals")} type="date" value={goal.target_date ?? ""} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`goal-priority-${goal.key}`}>How much it matters</label>
                  <select className={`${field} bg-surface`} id={`goal-priority-${goal.key}`} name={`goals.${index}.priority`} onChange={(event) => update(setGoals, goal.key, { priority: Number(event.target.value) }, "goals")} value={goal.priority}>
                    <option value="1">1 — least</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 — most</option>
                  </select>
                </div>
              </div>
              <button className="mt-3 text-sm text-muted underline" onClick={() => remove(setGoals, goal.key, "goals")} type="button">Remove goal</button>
            </div>
          ))}
          <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={goals.length >= onboardingLimits.goals.max} onClick={() => setGoals((rows) => [...rows, { area_key: areas[0]?.key ?? "", description: null, key: newKey(), priority: 3, target_date: null, title: "" }])} type="button">Add goal</button>
        </section>

        <section aria-labelledby="onboarding-key-dates" className="space-y-4">
          <h2 className="text-xl font-semibold" id="onboarding-key-dates">Key dates <span className="text-base font-normal text-muted">Optional</span>{marker("key_dates")}</h2>
          <p className="text-sm leading-6 text-muted">Deadlines, milestones, events, or reviews attached to a goal. Up to twenty-four.</p>
          {keyDates.map((keyDate, index) => (
            <div className="rounded-xl border border-line bg-background p-4" key={keyDate.key}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor={`key-date-title-${keyDate.key}`}>Title</label>
                  <input className={`${field} bg-surface`} id={`key-date-title-${keyDate.key}`} maxLength={onboardingLimits.text.key_date_title} name={`key_dates.${index}.title`} onChange={(event) => update(setKeyDates, keyDate.key, { title: event.target.value }, "key_dates")} required value={keyDate.title} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`key-date-goal-${keyDate.key}`}>Goal</label>
                  <select className={`${field} bg-surface`} id={`key-date-goal-${keyDate.key}`} name={`key_dates.${index}.goal_key`} onChange={(event) => update(setKeyDates, keyDate.key, { goal_key: event.target.value }, "key_dates")} required value={keyDate.goal_key}>
                    <option value="">Choose a goal</option>
                    {goals.map((goal) => <option key={goal.key} value={goal.key}>{goal.title || "Untitled goal"}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor={`key-date-kind-${keyDate.key}`}>Kind</label>
                  <select className={`${field} bg-surface`} id={`key-date-kind-${keyDate.key}`} name={`key_dates.${index}.kind`} onChange={(event) => update(setKeyDates, keyDate.key, { kind: event.target.value as OnboardingKeyDate["kind"] }, "key_dates")} value={keyDate.kind}>
                    {keyDateKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor={`key-date-due-${keyDate.key}`}>Date</label>
                  <input className={`${field} bg-surface`} id={`key-date-due-${keyDate.key}`} name={`key_dates.${index}.due_on`} onChange={(event) => update(setKeyDates, keyDate.key, { due_on: event.target.value || null }, "key_dates")} required type="date" value={keyDate.due_on ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor={`key-date-notes-${keyDate.key}`}>Notes <span className="font-normal text-muted">Optional</span></label>
                  <textarea className={`${field} min-h-16 bg-surface`} id={`key-date-notes-${keyDate.key}`} maxLength={onboardingLimits.text.key_date_notes} name={`key_dates.${index}.notes`} onChange={(event) => update(setKeyDates, keyDate.key, { notes: event.target.value }, "key_dates")} value={keyDate.notes ?? ""} />
                </div>
              </div>
              <button className="mt-3 text-sm text-muted underline" onClick={() => remove(setKeyDates, keyDate.key, "key_dates")} type="button">Remove key date</button>
            </div>
          ))}
          <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={keyDates.length >= onboardingLimits.key_dates.max} onClick={() => setKeyDates((rows) => [...rows, { due_on: null, goal_key: goals[0]?.key ?? "", key: newKey(), kind: "milestone", notes: null, title: "" }])} type="button">Add key date</button>
        </section>

        <section aria-labelledby="onboarding-commitments" className="space-y-4">
          <h2 className="text-xl font-semibold" id="onboarding-commitments">First commitments{marker("commitments")}</h2>
          <p className="text-sm leading-6 text-muted">The first concrete thing you will do toward a goal. At least one; the daily ritual needs a commitment to carry.</p>
          {commitments.map((commitment, index) => (
            <div className="rounded-xl border border-line bg-background p-4" key={commitment.key}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor={`commitment-title-${commitment.key}`}>Commitment</label>
                  <input className={`${field} bg-surface`} id={`commitment-title-${commitment.key}`} maxLength={onboardingLimits.text.commitment_title} name={`commitments.${index}.title`} onChange={(event) => update(setCommitments, commitment.key, { title: event.target.value }, "commitments")} required value={commitment.title} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`commitment-goal-${commitment.key}`}>Goal</label>
                  <select className={`${field} bg-surface`} id={`commitment-goal-${commitment.key}`} name={`commitments.${index}.goal_key`} onChange={(event) => update(setCommitments, commitment.key, { goal_key: event.target.value }, "commitments")} required value={commitment.goal_key}>
                    <option value="">Choose a goal</option>
                    {goals.map((goal) => <option key={goal.key} value={goal.key}>{goal.title || "Untitled goal"}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor={`commitment-due-${commitment.key}`}>Due date <span className="font-normal text-muted">Optional</span></label>
                  <input className={`${field} bg-surface`} id={`commitment-due-${commitment.key}`} name={`commitments.${index}.due_on`} onChange={(event) => update(setCommitments, commitment.key, { due_on: event.target.value || null }, "commitments")} type="date" value={commitment.due_on ?? ""} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`commitment-details-${commitment.key}`}>Details <span className="font-normal text-muted">Optional</span></label>
                  <textarea className={`${field} min-h-16 bg-surface`} id={`commitment-details-${commitment.key}`} maxLength={onboardingLimits.text.commitment_details} name={`commitments.${index}.details`} onChange={(event) => update(setCommitments, commitment.key, { details: event.target.value }, "commitments")} value={commitment.details ?? ""} />
                </div>
              </div>
              <button className="mt-3 text-sm text-muted underline" onClick={() => remove(setCommitments, commitment.key, "commitments")} type="button">Remove commitment</button>
            </div>
          ))}
          <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={commitments.length >= onboardingLimits.commitments.max} onClick={() => setCommitments((rows) => [...rows, { details: null, due_on: null, goal_key: goals[0]?.key ?? "", key: newKey(), title: "" }])} type="button">Add commitment</button>
        </section>
      </fieldset>

      {state.status !== "idle" ? <p aria-live="polite" className={state.status === "error" ? "text-sm text-red-700" : "text-sm text-accent"}>{state.message}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-full border border-line px-5 py-3 text-sm font-semibold disabled:opacity-60" disabled={pending} formNoValidate type="submit">
          {pending ? "Saving…" : "Save draft"}
        </button>
        {hasSavedDraft ? (
          <Link className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white" href="/welcome/review">Continue to review</Link>
        ) : (
          <span className="text-sm text-muted">Save your draft to continue to review.</span>
        )}
      </div>
      <p className="text-sm leading-6 text-muted">
        Saving keeps a draft only. Nothing becomes part of your ledger until you commit the founding statement on the review page, and an agent can never do that for you.
      </p>
    </form>
  );
}
