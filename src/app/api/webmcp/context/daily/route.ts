import { NextResponse } from "next/server";
import { getDailyRitual } from "@/lib/rituals/daily";
import { dailyAgentBrief } from "@/lib/webmcp/briefs";
export async function GET() { try { const ritual = await getDailyRitual(); return NextResponse.json({ agent_brief: dailyAgentBrief, period_start: ritual.periodStart, session: ritual.session, entry: ritual.entry, commitments: ritual.commitments }); } catch { return NextResponse.json({ error: "Unable to load the daily context." }, { status: 401 }); } }
