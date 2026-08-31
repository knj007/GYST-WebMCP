import { NextResponse } from "next/server";
import { getWeeklyRitual } from "@/lib/rituals/weekly";
export async function GET() { try { const ritual = await getWeeklyRitual(); return NextResponse.json({ period_start: ritual.periodStart, context: ritual.context, session: ritual.session, entry: ritual.entry }); } catch { return NextResponse.json({ error: "Unable to load the weekly context." }, { status: 401 }); } }
