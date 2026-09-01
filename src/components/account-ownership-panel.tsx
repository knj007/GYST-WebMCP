"use client";

import { useActionState } from "react";

import { deleteMyAccount, type AccountDeletionState } from "@/app/(ritual)/settings/account/actions";

const initialState: AccountDeletionState = { message: "", status: "idle" };

export function AccountOwnershipPanel() {
  const [state, action, pending] = useActionState(deleteMyAccount, initialState);

  return <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Your data</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight">Keep a copy or close your account.</h1>
    <p className="mt-4 max-w-2xl leading-7 text-muted">Exports are prepared on the server from your owner-scoped ledger records. They never include credentials, tokens, or provider secrets.</p>
    <div className="mt-8 grid gap-4 rounded-2xl border border-line bg-background p-6 sm:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold">Committed records</h2>
        <p className="mt-2 text-sm leading-6 text-muted">A portable JSON file and a readable Markdown archive of your committed daily and weekly rituals.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent" href="/api/exports/json">Download JSON</a>
          <a className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent" href="/api/exports/markdown">Download Markdown</a>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Full backup</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Use this only when you intentionally want drafts included alongside committed records.</p>
        <a className="mt-4 inline-flex rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent" href="/api/exports/json?full_backup=1">Download full JSON backup</a>
      </div>
    </div>
    <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 p-6 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
      <h2 className="text-lg font-semibold">Delete permanent account</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6">This permanently deletes your Auth identity, revokes its sessions, and cascades only your owned ledger rows. Download an export first: this cannot be undone.</p>
      <form action={action} className="mt-5 flex max-w-md flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="confirmation">Type DELETE to confirm</label>
        <input autoComplete="off" className="rounded-xl border border-red-300 bg-white px-3 py-2 text-foreground dark:border-red-800 dark:bg-background" id="confirmation" name="confirmation" required />
        {state.status === "error" ? <p aria-live="polite" className="text-sm">{state.message}</p> : null}
        <button className="w-fit rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Deleting account…" : "Delete my account permanently"}</button>
      </form>
    </div>
  </section>;
}
