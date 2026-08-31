import { NextResponse } from "next/server";
import { getWeeklyRitual } from "@/lib/rituals/weekly";
import { weeklyAgentBrief } from "@/lib/webmcp/briefs";
export async function GET() { try { const ritual = await getWeeklyRitual(); return NextResponse.json({ agent_brief: weeklyAgentBrief, period_start: ritual.periodStart, context: ritual.context, session: ritual.session, entry: ritual.entry }); } catch { return NextResponse.json({ error: "Unable to load the weekly context." }, { status: 401 }); } }
