"use client";

import { useActionState } from "react";
import Link from "next/link";

import { type CommitOnboardingActionState, commitOnboarding } from "@/app/(welcome)/welcome/review/actions";

const initialState: CommitOnboardingActionState = { message: "", status: "idle" };

export function CommitFoundingStatementForm({ draftId, version }: { draftId: string; version: number }) {
  const [state, action, pending] = useActionState(commitOnboarding, initialState);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input name="draft_id" type="hidden" value={draftId} />
      <input name="draft_version" type="hidden" value={version} />
      {state.status === "error" ? (
        <p aria-live="polite" className="text-sm text-red-700">
          {state.message}
          {state.fixable ? <> <Link className="font-medium underline" href="/welcome/goals">Edit the draft</Link>.</> : null}
        </p>
      ) : null}
      <button className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Committing…" : "Commit founding statement"}
      </button>
      <p className="text-sm leading-6 text-muted">
        This is a human-only action. It writes your areas, goals, key dates, and first commitments in one transaction and marks this ledger founded. Agents cannot perform it.
      </p>
    </form>
  );
}
