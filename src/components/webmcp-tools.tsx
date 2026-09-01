"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { markAgentDraftFields } from "@/lib/webmcp/draft-provenance";

type Tool = { annotations?: { readOnlyHint?: boolean }; description: string; execute: (input: unknown) => Promise<unknown>; inputSchema: object; name: string };
type ModelContext = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => Promise<void> };
type MutationResult = { effect: string; message: string; uncommitted: true; updated_fields: string[] };

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
  { name: "gyst.get_daily_context", description: "Read only the authenticated owner’s current daily ritual context. Use returned IDs exactly when a later tool requires one.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/daily") },
  { name: "gyst.review_daily_draft", description: "Read only the authenticated owner’s current daily draft before proposing or changing it.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/daily") },
  mutation("gyst.record_moved", "Draft-only: record what the user says moved today. Do not invent wording. This never commits or closes the record.", { text: text(12000) }, ["text"]),
  mutation("gyst.record_blocker", "Draft-only: record or clear a blocker only from the user’s stated facts. This never commits or closes the record.", {}, [], blockerSchema),
  mutation("gyst.score_previous_commitment", "Draft-only: set the prior commitment outcome the user provides. This never commits or closes the record.", { commitment_id: uuid, outcome: { type: "string", enum: ["done", "partial", "deferred", "not_done", "planned_skip"] } }, ["commitment_id", "outcome"]),
  mutation("gyst.set_next_commitment", "Draft-only: set the next commitment chosen by the user. This never commits or closes the record.", { commitment_id: uuid }, ["commitment_id"]),
  mutation("gyst.record_optional_context", "Draft-only: record optional context in the user’s own terms. This never commits or closes the record.", { buried_win: { type: "string", maxLength: 4000 }, optional_context: { type: "string", maxLength: 12000 }, is_sensitive: { type: "boolean" } }),
];
const weeklyTools: Tool[] = [
  { name: "gyst.get_weekly_context", description: "Read only the authenticated owner’s bounded current-week context. Use it before asking for facts that are already present.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/weekly") },
  { name: "gyst.review_weekly_draft", description: "Read only the authenticated owner’s current weekly draft before proposing or changing it.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/weekly") },
  mutation("gyst.record_missing_metric", "Draft-only: record missing metrics the user identifies. This never commits or closes the record.", { items: { type: "array", maxItems: 12, items: text(500) } }, ["items"]),
  mutation("gyst.record_weekly_observation", "Draft-only: record the user’s observations without inventing conclusions. This never commits or closes the record.", { items: { type: "array", maxItems: 12, items: text(2000) } }, ["items"]),
  mutation("gyst.set_weekly_decision", "Draft-only: set the decision in the user’s own wording. Ask if the decision is missing. This never commits or closes the record.", { text: text(12000) }, ["text"]),
  mutation("gyst.set_weekly_arrow", "Draft-only: set the arrow the user chooses. This never commits or closes the record.", { arrow: { type: "string", enum: ["up", "steady", "down"] } }, ["arrow"]),
  mutation("gyst.set_weekly_priority", "Draft-only: set dated priorities chosen by the user. Ask for missing dates; do not invent them. This never commits or closes the record.", { priorities: { type: "array", minItems: 1, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "due_on"], properties: { title: text(500), due_on: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } } } } }, ["priorities"]),
];

function mutation(name: string, description: string, properties: Record<string, object>, required: string[] = [], inputSchema?: object): Tool {
  const action = name.replace("gyst.", "");
  const route = action.startsWith("set_weekly") || action.startsWith("record_weekly") || action === "record_missing_metric" ? "/api/webmcp/weekly" : "/api/webmcp/daily";
  return { name, description, inputSchema: inputSchema ?? { type: "object", additionalProperties: false, properties, required }, execute: async (input) => {
    const result = await post(route, { action, input }) as MutationResult;
    window.dispatchEvent(new CustomEvent("gyst:webmcp-draft-updated", { detail: { fields: result.updated_fields, name } }));
    return result;
  } };
}
async function request(url: string, init?: RequestInit) { const response = await fetch(url, init); const body: unknown = await response.json(); if (!response.ok) throw new Error(typeof body === "object" && body && "error" in body ? String(body.error) : "Draft update failed."); return body; }
function get(url: string) { return request(url); }
function post(url: string, body: unknown) { return request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }

function toolLabel(name: string) {
  return name.replace("gyst.", "").replaceAll("_", " ");
}

export function WebMcpTools({ periodStart, ritual }: { periodStart: string; ritual: "daily" | "weekly" }) {
  const router = useRouter();
  const [changes, setChanges] = useState<Array<{ fields: string[]; name: string }>>([]);
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const ritualKey = `${ritual}:${periodStart}`;
  const tools = ritual === "daily" ? dailyTools : weeklyTools;
  useEffect(() => { const listener = (event: Event) => { const detail = (event as CustomEvent<{ fields: string[]; name: string }>).detail; markAgentDraftFields(ritualKey, detail.fields); setChanges((current) => [detail, ...current].slice(0, 5)); router.refresh(); }; window.addEventListener("gyst:webmcp-draft-updated", listener); return () => window.removeEventListener("gyst:webmcp-draft-updated", listener); }, [ritualKey, router]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context) {
      const unavailable = window.setTimeout(() => setRegisteredCount(-1), 0);
      return () => window.clearTimeout(unavailable);
    }
    const controller = new AbortController(); let active = true;
    void Promise.all(tools.map((tool) => context.registerTool(tool, { signal: controller.signal }).then(() => true).catch(() => false))).then((registered) => { if (active) setRegisteredCount(registered.filter(Boolean).length); });
    return () => { active = false; controller.abort(); };
  }, [tools]);
  const capability = registeredCount === null ? "Checking whether agent assistance is available…" : registeredCount === -1 ? "Agent assistance is unavailable in this browser. Your normal draft form remains fully available." : registeredCount === tools.length ? `Agent assistance is ready: all ${tools.length} draft-only tools are available in this tab.` : `Agent assistance is partially available: ${registeredCount} of ${tools.length} draft-only tools registered.`;
  return <section className="mt-6 space-y-3" aria-label="Agent assistance">
    <aside aria-live="polite" className="rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm"><p className="font-semibold">WebMCP agent assistance</p><p className="mt-1 leading-6 text-muted">{capability}</p><p className="mt-2 text-muted">An agent can read this ritual and prepare its draft. Only you can commit the final ledger record.</p><details className="mt-3 text-muted"><summary className="cursor-pointer font-medium text-foreground">View this ritual’s tools</summary><ul className="mt-2 list-disc pl-5">{tools.map((tool) => <li key={tool.name}>{toolLabel(tool.name)}{tool.annotations?.readOnlyHint ? " — read only" : " — draft only"}</li>)}</ul></details></aside>
    {changes.length ? <aside aria-live="polite" className="rounded-xl border border-accent bg-accent-soft p-4 text-sm"><p className="font-semibold">Recent agent draft changes</p><ul className="mt-2 list-disc pl-5">{changes.map((change, index) => <li key={`${change.name}-${index}`}>{toolLabel(change.name)} updated {change.fields.map(toolLabel).join(", ")}; it was not committed.</li>)}</ul></aside> : null}
  </section>;
}
