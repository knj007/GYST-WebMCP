"use client";

import { useActionState } from "react";
import Link from "next/link";

import { type AddCommitmentActionState, addCommitment } from "@/lib/commitments/actions";
import type { ActiveGoal } from "@/lib/commitments/goals";

const initialState: AddCommitmentActionState = { message: "", status: "idle" };

type AddCommitmentFormProps = {
  goals: ActiveGoal[];
  onboarded: boolean;
};

/**
 * The human-only "add a commitment" control. It posts to a server action that
 * calls `add_commitment`; no WebMCP tool reaches that RPC.
 */
export function AddCommitmentForm({ goals, onboarded }: AddCommitmentFormProps) {
  const [state, action, pending] = useActionState(addCommitment, initialState);

  return (
    <details className="mt-8 rounded-xl border border-line bg-background p-4">
      <summary className="cursor-pointer font-semibold">Add a commitment</summary>
      <p className="mt-2 text-sm leading-6 text-muted">
        A commitment is one concrete promise under a goal. Adding one is a human-only action; agents can only choose among the commitments you have made.
      </p>
      {goals.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted">
          {onboarded
            ? "You have no active goals yet. Goals come from your founding statement for now, so there is nothing to attach a commitment to."
            : <>You have no active goals yet. <Link className="font-medium text-foreground underline" href="/welcome/goals">Set your goals first</Link>, then add commitments under them.</>}
        </p>
      ) : (
        <form action={action} className="mt-4 space-y-4">
          <fieldset className="space-y-4" disabled={pending}>
            <div>
              <label className="block text-sm font-semibold" htmlFor="add-commitment-goal">Goal</label>
              <select className="mt-1 w-full rounded-xl border border-line bg-surface p-3" defaultValue="" id="add-commitment-goal" name="goal_id" required>
                <option value="">Choose a goal</option>
                {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="add-commitment-title">Commitment</label>
              <input className="mt-1 w-full rounded-xl border border-line bg-surface p-3" id="add-commitment-title" maxLength={500} name="title" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold" htmlFor="add-commitment-due">Due date <span className="font-normal text-muted">Optional</span></label>
                <input className="mt-1 w-full rounded-xl border border-line bg-surface p-3" id="add-commitment-due" name="due_on" type="date" />
              </div>
              <div>
                <label className="block text-sm font-semibold" htmlFor="add-commitment-details">Details <span className="font-normal text-muted">Optional</span></label>
                <input className="mt-1 w-full rounded-xl border border-line bg-surface p-3" id="add-commitment-details" maxLength={8000} name="details" />
              </div>
            </div>
          </fieldset>
          {state.status !== "idle" ? <p aria-live="polite" className={state.status === "error" ? "text-sm text-red-700" : "text-sm text-accent"}>{state.message}</p> : null}
          <button className="rounded-full border border-line px-5 py-3 text-sm font-semibold disabled:opacity-60" disabled={pending} type="submit">
            {pending ? "Adding…" : "Add commitment"}
          </button>
        </form>
      )}
    </details>
  );
}
