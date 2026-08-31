import type { Database } from "@/lib/db/database.types";

export type WeeklyDraft = {
  arrow: Database["public"]["Enums"]["weekly_arrow"] | null;
  decision_text: string | null;
  missing_metrics: string[];
  observations: string[];
  priorities: Array<{ due_on: string; title: string }>;
};

const arrows = new Set<WeeklyDraft["arrow"]>(["up", "steady", "down"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function lines(formData: FormData, field: string, maxItems: number, maxLength: number) {
  const value = formData.get(field);
  if (typeof value !== "string") return [];
  const items = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (items.length > maxItems || items.some((item) => item.length > maxLength)) {
    throw new Error("One of the weekly draft fields is too long.");
  }
  return items;
}

export function readWeeklyDraft(formData: FormData): WeeklyDraft {
  const priorities = lines(formData, "priorities", 5, 512).map((line) => {
    const [rawTitle, rawDueOn, ...rest] = line.split("|").map((part) => part.trim());
    if (!rawTitle || rawTitle.length > 500 || !rawDueOn || !datePattern.test(rawDueOn) || rest.length > 0) {
      throw new Error("Each priority must use “Title | YYYY-MM-DD”.");
    }
    return { due_on: rawDueOn, title: rawTitle };
  });
  const decision = formData.get("decision_text");
  const decisionText = typeof decision === "string" ? decision.trim() : "";
  if (decisionText.length > 12000) throw new Error("One of the weekly draft fields is too long.");
  const rawArrow = formData.get("arrow");

  return {
    arrow: typeof rawArrow === "string" && arrows.has(rawArrow as WeeklyDraft["arrow"])
      ? (rawArrow as WeeklyDraft["arrow"])
      : null,
    decision_text: decisionText || null,
    missing_metrics: lines(formData, "missing_metrics", 12, 500),
    observations: lines(formData, "observations", 12, 2000),
    priorities,
  };
}
