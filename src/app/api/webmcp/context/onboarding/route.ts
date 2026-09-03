import { NextResponse } from "next/server";
import { emptyOnboardingDraft, onboardingDraftContract } from "@/lib/onboarding/draft";
import { getOnboardingRecord } from "@/lib/onboarding/record";
import { onboardingAgentBrief } from "@/lib/webmcp/briefs";
export async function GET() {
  try {
    const { identity, record } = await getOnboardingRecord();
    if (identity.isDemo) return NextResponse.json({ error: "The demo ledger is already prepared; onboarding tools are unavailable." }, { status: 403 });
    return NextResponse.json({ agent_brief: onboardingAgentBrief, contract: onboardingDraftContract, draft: record?.draft ?? emptyOnboardingDraft(), draft_id: record?.id ?? null, status: record?.status ?? "draft", version: record?.version ?? null });
  } catch {
    return NextResponse.json({ error: "Unable to load the onboarding context." }, { status: 401 });
  }
}
