"use client";

import { useActionState } from "react";

import { commitWeeklyRitual, saveWeeklyDraft, type WeeklyActionState } from "@/app/(ritual)/weekly/actions";
import type { WeeklyRitual } from "@/lib/rituals/weekly";
import { useAgentDraftFields } from "@/lib/webmcp/draft-provenance";

const initialState: WeeklyActionState = { message: "", status: "idle" };

function toLines(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";
}

function priorityLines(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const priority = item as { due_on?: unknown; title?: unknown };
    return typeof priority.title === "string" && typeof priority.due_on === "string" ? [`${priority.title} | ${priority.due_on}`] : [];
  }).join("\n") : "";
}

export function WeeklyRitualForm({ ritual }: { ritual: WeeklyRitual }) {
  const [saveState, saveAction, saving] = useActionState(saveWeeklyDraft, initialState);
  const [commitState, commitAction, committing] = useActionState(commitWeeklyRitual, initialState);
  const { entry, session } = ritual;
  const provenance = useAgentDraftFields(`weekly:${ritual.periodStart}`);
  const committed = session?.status === "committed";
  const message = commitState.message || saveState.message;
  const pending = saving || committing;
  const marker = (field: string) => provenance.agentUpdated(field) ? <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Agent updated — review</span> : null;
  if (committed) return <section className="mt-8 rounded-2xl border border-line bg-background p-6"><h2 className="text-xl font-semibold">This week&apos;s record is committed.</h2><p className="mt-2 text-muted">It is preserved as an immutable ledger record.</p></section>;
  return <form className="mt-8 space-y-6" action={saveAction}>
    <input name="session_version" type="hidden" value={session?.version ?? ""} />
    {provenance.fields.size ? <aside className="rounded-xl border border-accent bg-accent-soft p-4 text-sm" aria-live="polite"><p className="font-semibold">Review agent draft changes before committing</p><p className="mt-1 text-muted">Marked fields were updated by an agent in this tab. Edit a field to take it back into your own review.</p></aside> : null}
    <fieldset disabled={pending} className="space-y-6">
      <label className="block text-sm font-semibold" htmlFor="missing_metrics">Missing metrics{marker("missing_metrics")}</label>
      <textarea className="mt-2 min-h-20 w-full rounded-xl border border-line bg-background p-3" defaultValue={toLines(entry?.missing_metrics)} id="missing_metrics" name="missing_metrics" onInput={() => provenance.clearHumanEdit("missing_metrics")} placeholder="One missing metric per line" />
      <label className="block text-sm font-semibold" htmlFor="observations">Observations{marker("observations")}</label>
      <textarea className="mt-2 min-h-28 w-full rounded-xl border border-line bg-background p-3" defaultValue={toLines(entry?.observations)} id="observations" name="observations" onInput={() => provenance.clearHumanEdit("observations")} placeholder="What did the week show you? One observation per line." />
      <label className="block text-sm font-semibold" htmlFor="decision_text">Decision{marker("decision_text")}</label>
      <textarea className="mt-2 min-h-24 w-full rounded-xl border border-line bg-background p-3" defaultValue={entry?.decision_text ?? ""} id="decision_text" maxLength={12000} name="decision_text" onInput={() => provenance.clearHumanEdit("decision_text")} required />
      <label className="block text-sm font-semibold" htmlFor="arrow">Arrow{marker("arrow")}</label>
      <select className="mt-2 w-full rounded-xl border border-line bg-background p-3" defaultValue={entry?.arrow ?? ""} id="arrow" name="arrow" onChange={() => provenance.clearHumanEdit("arrow")} required><option value="">Choose an arrow</option><option value="up">Up</option><option value="steady">Steady</option><option value="down">Down</option></select>
      <label className="block text-sm font-semibold" htmlFor="priorities">Dated priorities{marker("priorities")}</label>
      <textarea className="mt-2 min-h-24 w-full rounded-xl border border-line bg-background p-3" defaultValue={priorityLines(entry?.priorities)} id="priorities" name="priorities" onInput={() => provenance.clearHumanEdit("priorities")} placeholder={'Priority title | 2026-09-07\nSecond priority | 2026-09-09'} required />
    </fieldset>
    {message ? <p aria-live="polite" className={commitState.status === "error" || saveState.status === "error" ? "text-red-700" : "text-accent"}>{message}</p> : null}
    <div className="flex flex-wrap gap-3"><button className="rounded-full border border-line px-5 py-3 text-sm font-semibold disabled:opacity-60" disabled={pending} formNoValidate type="submit">{saving ? "Saving…" : "Save draft"}</button><button className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} formAction={commitAction} type="submit">{committing ? "Committing…" : "Commit week"}</button></div>
    <p className="text-sm leading-6 text-muted">Drafts stay editable. “Commit week” is the ordinary human-only action; WebMCP can prepare a draft but has no commit control.</p>
  </form>;
}
