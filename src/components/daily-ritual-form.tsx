"use client";

import { useActionState } from "react";

import {
  commitDailyRitual,
  saveDailyDraft,
} from "@/app/(ritual)/daily/actions";
import type { DailyRitual } from "@/lib/rituals/daily";
import { useAgentDraftFields } from "@/lib/webmcp/draft-provenance";

type DailyRitualFormProps = Pick<DailyRitual, "commitments" | "entry" | "periodStart" | "session">;

const initialDailyActionState = { message: "", status: "idle" } as const;

function actionMessage(message: string, status: "error" | "idle" | "success") {
  if (!message || status === "idle") {
    return null;
  }

  return (
    <p aria-live="polite" className={status === "error" ? "text-sm text-red-700" : "text-sm text-accent"}>
      {message}
    </p>
  );
}

export function DailyRitualForm({ commitments, entry, periodStart, session }: DailyRitualFormProps) {
  const [saveState, saveAction, saving] = useActionState(saveDailyDraft, initialDailyActionState);
  const [commitState, commitAction, committing] = useActionState(commitDailyRitual, initialDailyActionState);
  const provenance = useAgentDraftFields(`daily:${periodStart}`);
  const isCommitted = session?.status === "committed";
  const isPending = saving || committing;
  const marker = (field: string) => provenance.agentUpdated(field) ? <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Agent updated — review</span> : null;

  if (isCommitted) {
    return (
      <section className="mt-8 rounded-2xl border border-accent bg-accent-soft p-6">
        <h2 className="text-xl font-semibold">Today&apos;s record is committed.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          It closed for {periodStart}. The ledger preserves the decision and its commitment outcome.
        </p>
      </section>
    );
  }

  return (
    <form action={saveAction} className="mt-8 space-y-6">
      <input name="session_version" type="hidden" value={session?.version ?? ""} />
      {provenance.fields.size ? <aside className="rounded-xl border border-accent bg-accent-soft p-4 text-sm" aria-live="polite"><p className="font-semibold">Review agent draft changes before committing</p><p className="mt-1 text-muted">Marked fields were updated by an agent in this tab. Edit a field to take it back into your own review.</p></aside> : null}
      <fieldset disabled={isPending} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold" htmlFor="moved_text">
            What moved today?{marker("moved_text")}
          </label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-line bg-background p-3"
            defaultValue={entry?.moved_text ?? ""}
            id="moved_text"
            maxLength={12000}
            name="moved_text"
            onInput={() => provenance.clearHumanEdit("moved_text")}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold" htmlFor="blocker_text">
            What got in the way? <span className="font-normal text-muted">Optional</span>{marker("blocker_text")}
          </label>
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border border-line bg-background p-3"
            defaultValue={entry?.blocker_text ?? ""}
            id="blocker_text"
            maxLength={8000}
            name="blocker_text"
            onInput={() => provenance.clearHumanEdit("blocker_text")}
          />
          <label className="mt-3 block text-sm" htmlFor="blocker_type">
            Blocker type{marker("blocker_type")}
          </label>
          <select
            className="mt-1 w-full rounded-xl border border-line bg-background p-3"
            defaultValue={entry?.blocker_type ?? ""}
            id="blocker_type"
            name="blocker_type"
            onChange={() => provenance.clearHumanEdit("blocker_type")}
          >
            <option value="">No blocker recorded</option>
            <option value="internal">Internal</option>
            <option value="external_gate">External gate</option>
            <option value="capacity">Capacity</option>
            <option value="clarity">Clarity</option>
            <option value="dependency">Dependency</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold" htmlFor="previous_commitment_id">
              Score the previous commitment{marker("previous_commitment_id")}
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-line bg-background p-3"
              defaultValue={entry?.previous_commitment_id ?? ""}
              id="previous_commitment_id"
              name="previous_commitment_id"
              onChange={() => provenance.clearHumanEdit("previous_commitment_id")}
              required
            >
              <option value="">Choose a commitment</option>
              {commitments.map((commitment) => (
                <option key={commitment.id} value={commitment.id}>
                  {commitment.title}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-sm" htmlFor="previous_commitment_outcome">
              Outcome{marker("previous_commitment_outcome")}
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-line bg-background p-3"
              defaultValue={entry?.previous_commitment_outcome ?? ""}
              id="previous_commitment_outcome"
              name="previous_commitment_outcome"
              onChange={() => provenance.clearHumanEdit("previous_commitment_outcome")}
              required
            >
              <option value="">Choose an outcome</option>
              <option value="done">Done</option>
              <option value="partial">Partial</option>
              <option value="deferred">Deferred</option>
              <option value="not_done">Not done</option>
              <option value="planned_skip">Planned skip</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="next_commitment_id">
              Choose tomorrow&apos;s commitment{marker("next_commitment_id")}
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-line bg-background p-3"
              defaultValue={entry?.next_commitment_id ?? ""}
              id="next_commitment_id"
              name="next_commitment_id"
              onChange={() => provenance.clearHumanEdit("next_commitment_id")}
              required
            >
              <option value="">Choose a commitment</option>
              {commitments.map((commitment) => (
                <option key={commitment.id} value={commitment.id}>
                  {commitment.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <details className="rounded-xl border border-line bg-background p-4">
          <summary className="cursor-pointer font-semibold">Optional context</summary>
          <label className="mt-4 block text-sm" htmlFor="buried_win">
            A buried win{marker("buried_win")}
          </label>
          <input
            className="mt-1 w-full rounded-xl border border-line bg-surface p-3"
            defaultValue={entry?.buried_win ?? ""}
            id="buried_win"
            maxLength={4000}
            name="buried_win"
            onInput={() => provenance.clearHumanEdit("buried_win")}
          />
          <label className="mt-4 block text-sm" htmlFor="optional_context">
            Context for your future self{marker("optional_context")}
          </label>
          <textarea
            className="mt-1 min-h-24 w-full rounded-xl border border-line bg-surface p-3"
            defaultValue={entry?.optional_context ?? ""}
            id="optional_context"
            maxLength={12000}
            name="optional_context"
            onInput={() => provenance.clearHumanEdit("optional_context")}
          />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input defaultChecked={entry?.is_sensitive ?? false} id="is_sensitive" name="is_sensitive" onChange={() => provenance.clearHumanEdit("is_sensitive")} type="checkbox" />
            Treat this context as sensitive{marker("is_sensitive")}
          </label>
        </details>
      </fieldset>

      {actionMessage(commitState.message || saveState.message, commitState.message ? commitState.status : saveState.status)}

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-full border border-line px-5 py-3 text-sm font-semibold disabled:opacity-60"
          disabled={isPending}
          formNoValidate
          type="submit"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button
          className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isPending || commitments.length === 0}
          formAction={commitAction}
          type="submit"
        >
          {committing ? "Committing…" : "Commit today"}
        </button>
      </div>

      {commitments.length === 0 ? (
        <p className="text-sm text-muted">Add an active commitment before closing a daily ritual.</p>
      ) : null}
      <p className="text-sm leading-6 text-muted">
        Drafts remain editable. “Commit today” is a human-only action that validates this record and closes it in one
        database transaction. WebMCP can prepare drafts but has no commit control.
      </p>
    </form>
  );
}
