import { NextResponse } from "next/server";

import { saveDailyDraft } from "@/app/(ritual)/daily/actions";
import { getDailyRitual } from "@/lib/rituals/daily";
import { blockerTypes, commitmentOutcomes, enumValue, optionalText, requireObject, requiredText, requiredUuid } from "@/lib/webmcp/contracts";

const idle = { message: "", status: "idle" } as const;

function draftUpdated(ritual: Awaited<ReturnType<typeof getDailyRitual>>, fields: string[]) {
  return NextResponse.json({
    effect: `Updated ${fields.join(", ")} in the visible daily draft. The record remains uncommitted and requires the owner’s review.`,
    message: "Draft updated. It was not committed.",
    period_start: ritual.periodStart,
    uncommitted: true as const,
    updated_fields: fields,
  });
}

function currentForm(ritual: Awaited<ReturnType<typeof getDailyRitual>>) {
  const form = new FormData();
  const entry = ritual.entry;
  if (ritual.session) form.set("session_version", String(ritual.session.version));
  for (const [key, value] of Object.entries({
    blocker_text: entry?.blocker_text, blocker_type: entry?.blocker_type, buried_win: entry?.buried_win,
    moved_text: entry?.moved_text, next_commitment_id: entry?.next_commitment_id, optional_context: entry?.optional_context,
    previous_commitment_id: entry?.previous_commitment_id, previous_commitment_outcome: entry?.previous_commitment_outcome,
  })) if (value) form.set(key, String(value));
  if (entry?.is_sensitive) form.set("is_sensitive", "on");
  return form;
}

export async function POST(request: Request) {
  try {
    const { action, input } = requireObject(await request.json());
    const ritual = await getDailyRitual();
    if (ritual.session?.status === "committed") throw new Error("Today's daily ritual is already committed.");
    const form = currentForm(ritual);
    const values = requireObject(input);
    let updatedFields: string[];
    switch (action) {
      case "record_moved": form.set("moved_text", requiredText(values.text, 12000, "text")); updatedFields = ["moved_text"]; break;
      case "record_blocker": {
        const text = optionalText(values.text, 8000, "text");
        if (text) { form.set("blocker_text", text); form.set("blocker_type", enumValue(values.type, blockerTypes, "type")); }
        else { form.delete("blocker_text"); form.delete("blocker_type"); }
        updatedFields = ["blocker_text", "blocker_type"];
        break;
      }
      case "score_previous_commitment": form.set("previous_commitment_id", requiredUuid(values.commitment_id, "commitment_id")); form.set("previous_commitment_outcome", enumValue(values.outcome, commitmentOutcomes, "outcome")); updatedFields = ["previous_commitment_id", "previous_commitment_outcome"]; break;
      case "set_next_commitment": form.set("next_commitment_id", requiredUuid(values.commitment_id, "commitment_id")); updatedFields = ["next_commitment_id"]; break;
      case "record_optional_context": {
        updatedFields = [];
        for (const [key, limit] of [["buried_win", 4000], ["optional_context", 12000]] as const) {
          if (values[key] === undefined) continue;
          const text = optionalText(values[key], limit, key);
          if (text) form.set(key, text); else form.delete(key);
          updatedFields.push(key);
        }
        if (values.is_sensitive !== undefined) {
          if (typeof values.is_sensitive !== "boolean") throw new Error("is_sensitive must be boolean.");
          if (values.is_sensitive) form.set("is_sensitive", "on"); else form.delete("is_sensitive");
          updatedFields.push("is_sensitive");
        }
        break;
      }
      default: throw new Error("Unsupported daily draft tool.");
    }
    const result = await saveDailyDraft(idle, form);
    if (result.status === "error") throw new Error(result.message);
    return draftUpdated(ritual, updatedFields);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update the daily draft." }, { status: 400 });
  }
}
