"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tool = { annotations?: { readOnlyHint?: boolean }; description: string; execute: (input: unknown) => Promise<unknown>; inputSchema: object; name: string };
type ModelContext = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => Promise<void> };

declare global { interface Document { modelContext?: ModelContext } }

const emptySchema = { type: "object", additionalProperties: false, properties: {} } as const;
const text = (maximum: number) => ({ type: "string", minLength: 1, maxLength: maximum });
const uuid = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" } as const;
const blockerSchema = {
  type: "object",
  additionalProperties: false,
  properties: { text: text(8000), type: { type: "string", enum: ["internal", "external_gate", "capacity", "clarity", "dependency", "other"] } },
  oneOf: [
    { required: ["text", "type"] },
    { not: { anyOf: [{ required: ["text"] }, { required: ["type"] }] } },
  ],
} as const;
const dailyTools: Tool[] = [
  { name: "gyst.get_daily_context", description: "Read only the authenticated owner’s current daily ritual context.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/daily") },
  { name: "gyst.review_daily_draft", description: "Read only the authenticated owner’s current daily draft.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/daily") },
  mutation("gyst.record_moved", "Record what moved in the current daily draft.", { text: text(12000) }, ["text"]),
  mutation("gyst.record_blocker", "Record or clear the blocker in the current daily draft.", {}, [], blockerSchema),
  mutation("gyst.score_previous_commitment", "Set the prior commitment score in the current daily draft.", { commitment_id: uuid, outcome: { type: "string", enum: ["done", "partial", "deferred", "not_done", "planned_skip"] } }, ["commitment_id", "outcome"]),
  mutation("gyst.set_next_commitment", "Set the next commitment in the current daily draft.", { commitment_id: uuid }, ["commitment_id"]),
  mutation("gyst.record_optional_context", "Record optional context in the current daily draft.", { buried_win: { type: "string", maxLength: 4000 }, optional_context: { type: "string", maxLength: 12000 }, is_sensitive: { type: "boolean" } }),
];
const weeklyTools: Tool[] = [
  { name: "gyst.get_weekly_context", description: "Read only the authenticated owner’s bounded current-week context.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/weekly") },
  { name: "gyst.review_weekly_draft", description: "Read only the authenticated owner’s current weekly draft.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/weekly") },
  mutation("gyst.record_missing_metric", "Set the missing metrics in the current weekly draft.", { items: { type: "array", maxItems: 12, items: text(500) } }, ["items"]),
  mutation("gyst.record_weekly_observation", "Set observations in the current weekly draft.", { items: { type: "array", maxItems: 12, items: text(2000) } }, ["items"]),
  mutation("gyst.set_weekly_decision", "Set the decision in the current weekly draft.", { text: text(12000) }, ["text"]),
  mutation("gyst.set_weekly_arrow", "Set the arrow in the current weekly draft.", { arrow: { type: "string", enum: ["up", "steady", "down"] } }, ["arrow"]),
  mutation("gyst.set_weekly_priority", "Set dated priorities in the current weekly draft.", { priorities: { type: "array", minItems: 1, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "due_on"], properties: { title: text(500), due_on: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } } } } }, ["priorities"]),
];

function mutation(name: string, description: string, properties: Record<string, object>, required: string[] = [], inputSchema?: object): Tool {
  const action = name.replace("gyst.", "");
  const route = action.startsWith("set_weekly") || action.startsWith("record_weekly") || action === "record_missing_metric" ? "/api/webmcp/weekly" : "/api/webmcp/daily";
  return { name, description, inputSchema: inputSchema ?? { type: "object", additionalProperties: false, properties, required }, execute: async (input) => {
    const result = await post(route, { action, input });
    window.dispatchEvent(new CustomEvent("gyst:webmcp-draft-updated", { detail: name }));
    return result;
  } };
}
async function request(url: string, init?: RequestInit) { const response = await fetch(url, init); const body: unknown = await response.json(); if (!response.ok) throw new Error(typeof body === "object" && body && "error" in body ? String(body.error) : "Draft update failed."); return body; }
function get(url: string) { return request(url); }
function post(url: string, body: unknown) { return request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }

export function WebMcpTools({ ritual }: { ritual: "daily" | "weekly" }) {
  const router = useRouter();
  const [changes, setChanges] = useState<string[]>([]);
  useEffect(() => { const listener = (event: Event) => { setChanges((current) => [String((event as CustomEvent<string>).detail), ...current].slice(0, 5)); router.refresh(); }; window.addEventListener("gyst:webmcp-draft-updated", listener); return () => window.removeEventListener("gyst:webmcp-draft-updated", listener); }, [router]);
  useEffect(() => {
    const context = document.modelContext; if (!context) return;
    const controller = new AbortController(); const tools = ritual === "daily" ? dailyTools : weeklyTools;
    void Promise.all(tools.map((tool) => context.registerTool(tool, { signal: controller.signal }).catch(() => undefined)));
    return () => controller.abort();
  }, [ritual]);
  return changes.length ? <aside aria-live="polite" className="mt-6 rounded-xl border border-accent bg-accent-soft p-4 text-sm"><p className="font-semibold">Recent agent draft changes</p><ul className="mt-2 list-disc pl-5">{changes.map((change, index) => <li key={`${change}-${index}`}>{change.replace("gyst.", "")} updated a draft; it was not committed.</li>)}</ul></aside> : null;
}
