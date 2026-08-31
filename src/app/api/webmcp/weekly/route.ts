import { NextResponse } from "next/server";

import { saveWeeklyDraft } from "@/app/(ritual)/weekly/actions";
import { getWeeklyRitual } from "@/lib/rituals/weekly";
import { enumValue, requireObject, requiredText, weeklyArrows } from "@/lib/webmcp/contracts";

const idle = { message: "", status: "idle" } as const;
function lines(values: string[]) { return values.join("\n"); }
function asStringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function asPriorities(value: unknown): Array<{ due_on: string; title: string }> {
  return Array.isArray(value) ? value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const priority = item as { due_on?: unknown; title?: unknown };
    return typeof priority.due_on === "string" && typeof priority.title === "string" ? [{ due_on: priority.due_on, title: priority.title }] : [];
  }) : [];
}
function formFor(ritual: Awaited<ReturnType<typeof getWeeklyRitual>>) {
  const form = new FormData(); const entry = ritual.entry;
  if (ritual.session) form.set("session_version", String(ritual.session.version));
  if (entry?.decision_text) form.set("decision_text", entry.decision_text);
  if (entry?.arrow) form.set("arrow", entry.arrow);
  form.set("missing_metrics", lines(asStringList(entry?.missing_metrics))); form.set("observations", lines(asStringList(entry?.observations)));
  form.set("priorities", asPriorities(entry?.priorities).map((priority) => `${priority.title} | ${priority.due_on}`).join("\n")); return form;
}
function stringList(value: unknown, field: string, maximumItems: number, maximumLength: number) {
  if (!Array.isArray(value) || value.length > maximumItems || value.some((item) => typeof item !== "string" || !item.trim() || item.trim().length > maximumLength)) throw new Error(`${field} must contain at most ${maximumItems} non-empty strings.`);
  return value.map((item) => (item as string).trim());
}
export async function POST(request: Request) {
  try {
    const { action, input } = requireObject(await request.json()); const ritual = await getWeeklyRitual();
    if (ritual.session?.status === "committed") throw new Error("This weekly ritual is already committed.");
    const form = formFor(ritual); const values = requireObject(input);
    switch (action) {
      case "record_missing_metric": form.set("missing_metrics", lines(stringList(values.items, "items", 12, 500))); break;
      case "record_weekly_observation": form.set("observations", lines(stringList(values.items, "items", 12, 2000))); break;
      case "set_weekly_decision": form.set("decision_text", requiredText(values.text, 12000, "text")); break;
      case "set_weekly_arrow": form.set("arrow", enumValue(values.arrow, weeklyArrows, "arrow")); break;
      case "set_weekly_priority": {
        const priorities = values.priorities;
        if (!Array.isArray(priorities) || priorities.length > 5) throw new Error("priorities must contain at most 5 items.");
        form.set("priorities", priorities.map((item) => { const priority = requireObject(item); const title = requiredText(priority.title, 500, "priority title"); const dueOn = requiredText(priority.due_on, 10, "priority due_on"); if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) throw new Error("priority due_on must use YYYY-MM-DD."); return `${title} | ${dueOn}`; }).join("\n")); break;
      }
      default: throw new Error("Unsupported weekly draft tool.");
    }
    const result = await saveWeeklyDraft(idle, form); if (result.status === "error") throw new Error(result.message);
    return NextResponse.json({ message: "Draft updated. It was not committed.", week_start: ritual.periodStart });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update the weekly draft." }, { status: 400 }); }
}
