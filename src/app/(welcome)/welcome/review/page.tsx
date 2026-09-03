import Link from "next/link";

import { CommitFoundingStatementForm } from "@/components/commit-founding-statement-form";
import { requireWelcomeStage } from "@/lib/onboarding/access";
import type { OnboardingDraft } from "@/lib/onboarding/draft";
import { getOnboardingRecord } from "@/lib/onboarding/record";

function byGoal<T extends { goal_key: string }>(items: T[], goalKey: string) {
  return items.filter((item) => item.goal_key === goalKey);
}

function DraftSummary({ draft }: { draft: OnboardingDraft }) {
  return (
    <div className="mt-8 grid gap-6">
      <section className="rounded-2xl border border-line bg-background p-6">
        <h2 className="text-xl font-semibold">About you</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Name</dt><dd>{draft.display_name ?? "Not given"}</dd></div>
          <div><dt className="text-muted">Time zone</dt><dd>{draft.timezone ?? "Not set"}</dd></div>
        </dl>
      </section>
      {draft.areas.map((area) => (
        <section className="rounded-2xl border border-line bg-background p-6" key={area.key}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Area</p>
          <h2 className="mt-1 text-xl font-semibold">{area.title || "Untitled area"}</h2>
          {area.description ? <p className="mt-1 text-sm leading-6 text-muted">{area.description}</p> : null}
          {draft.goals.filter((goal) => goal.area_key === area.key).map((goal) => (
            <article className="mt-4 rounded-xl border border-line bg-surface p-4" key={goal.key}>
              <h3 className="font-semibold">{goal.title || "Untitled goal"}</h3>
              <p className="mt-1 text-sm text-muted">
                Matters {goal.priority} of 5{goal.target_date ? ` · due ${goal.target_date}` : ""}
              </p>
              {goal.description ? <p className="mt-2 text-sm leading-6">{goal.description}</p> : null}
              {byGoal(draft.key_dates, goal.key).length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Key dates</p>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {byGoal(draft.key_dates, goal.key).map((keyDate, index) => (
                      <li key={`${goal.key}-date-${index}`}>{keyDate.title} — {keyDate.kind}{keyDate.due_on ? ` on ${keyDate.due_on}` : ""}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">First commitments</p>
                {byGoal(draft.commitments, goal.key).length ? (
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {byGoal(draft.commitments, goal.key).map((commitment, index) => (
                      <li key={`${goal.key}-commitment-${index}`}>{commitment.title}{commitment.due_on ? ` · due ${commitment.due_on}` : ""}</li>
                    ))}
                  </ul>
                ) : <p className="mt-1 text-sm text-muted">None under this goal.</p>}
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

export default async function WelcomeReviewPage() {
  await requireWelcomeStage("review");
  const { record } = await getOnboardingRecord();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Review</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Your founding statement.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        This founding statement is immutable and dated: what you said mattered, and why, on the day you founded this ledger. The goals and commitments it seeds are living records; you can retarget, pause, or complete them later without changing what you said today.
      </p>

      {record ? (
        <>
          <DraftSummary draft={record.draft} />
          <p className="mt-6 text-sm leading-6 text-muted">
            Something missing? <Link className="font-medium text-foreground underline" href="/welcome/goals">Go back and edit the draft</Link> before committing.
          </p>
          <CommitFoundingStatementForm draftId={record.id} version={record.version} />
        </>
      ) : (
        <p className="mt-8 rounded-2xl border border-line bg-background p-5 text-sm leading-6 text-muted">
          There is no saved draft to review yet. <Link className="font-medium text-foreground underline" href="/welcome/goals">Draft your goals</Link> and save them first.
        </p>
      )}
    </section>
  );
}
