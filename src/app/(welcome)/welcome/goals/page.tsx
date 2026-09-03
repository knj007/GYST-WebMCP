import { CopyableText } from "@/components/copyable-text";
import { OnboardingDraftForm } from "@/components/onboarding-draft-form";
import { WebMcpTools } from "@/components/webmcp-tools";
import { requireWelcomeStage } from "@/lib/onboarding/access";
import { emptyOnboardingDraft } from "@/lib/onboarding/draft";
import { getOnboardingRecord } from "@/lib/onboarding/record";

// Provenance markers are keyed to the owner's single draft, which exists
// before it has an id, so the key is a constant rather than the row id.
const draftKey = "draft";

const agentPrompt = `You are helping me found my GYST ledger. This page exposes WebMCP tools named gyst.get_onboarding_draft, gyst.propose_areas, gyst.propose_goals, gyst.propose_key_dates, and gyst.propose_first_commitments.

Rules:
- Call gyst.get_onboarding_draft first and reuse the area and goal keys it returns.
- Interview me. Ask about the areas of my life or work, the goals inside each, why each goal matters, when it is due, how much it matters (1 to 5), any dates that matter, and the first concrete commitment for each goal.
- Propose only what I said, in my words. Never invent an area, goal, date, or commitment. If something is missing, ask me instead of guessing.
- Each propose tool replaces one list in my draft; read the draft again before replacing it.
- You cannot commit anything. When the draft reflects what I said, tell me to review and commit it myself.`;

export default async function WelcomeGoalsPage() {
  await requireWelcomeStage("goals");
  const { record } = await getOnboardingRecord();
  const draft = record?.draft ?? emptyOnboardingDraft();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Goals</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Say what matters, and why.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        Areas first, then the goals inside them, then the first commitment toward each. Fill it in by hand, or hand the prompt below to an agent and review what it drafts. Either way, nothing is committed on this page.
      </p>

      <aside className="mt-8 rounded-2xl border border-accent/20 bg-accent/5 p-5" aria-label="Optional agent interview">
        <p className="font-semibold">Optional: let an agent interview you</p>
        <p className="mt-1 text-sm leading-6 text-muted">Paste this into a WebMCP-capable agent in this tab. It can read and draft; it cannot commit.</p>
        <div className="mt-4">
          <CopyableText id="onboarding-agent-prompt" label="Agent prompt" rows={10} text={agentPrompt} />
        </div>
      </aside>

      <WebMcpTools draftKey={draftKey} ritual="onboarding" />

      <OnboardingDraftForm draft={draft} draftKey={draftKey} draftVersion={record?.version ?? null} key={record?.version ?? "new-onboarding-draft"} />
    </section>
  );
}
