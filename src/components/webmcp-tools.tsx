"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { markAgentDraftFields } from "@/lib/webmcp/draft-provenance";

export type WebMcpTool = { annotations?: { readOnlyHint?: boolean }; description: string; execute: (input: unknown) => Promise<unknown>; inputSchema: object; name: string };
type ModelContext = { registerTool: (tool: WebMcpTool, options: { signal: AbortSignal }) => Promise<void> };
type MutationResult = { effect: string; message: string; uncommitted: true; updated_fields: string[] };
type RegistrationFailure = { name: string; reason: string };
export type WebMcpToolsProps =
  | { periodStart: string; ritual: "daily" | "weekly" }
  // Onboarding has no period; a stable key scopes its provenance markers.
  | { draftKey: string; ritual: "onboarding" };

declare global { interface Document { modelContext?: ModelContext } }

const emptySchema = { type: "object", additionalProperties: false, properties: {} } as const;
const modelContextRetryIntervalMs = 50;
const modelContextWaitMs = 250;
const text = (maximum: number) => ({ type: "string", minLength: 1, maxLength: maximum });
const optionalText = (maximum: number) => ({ type: "string", maxLength: maximum });
const date = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;
const uuid = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" } as const;
const entries = (maximum: number, minimum: number, properties: Record<string, object>, required: string[]) => ({ type: "array", minItems: minimum, maxItems: maximum, items: { type: "object", additionalProperties: false, required, properties } });
// Each draft-only mutation posts to the route that owns its ritual. The first
// matching prefix wins; anything unmatched is a daily tool.
const mutationRouteByActionPrefix: Record<string, string> = {
  propose_: "/api/webmcp/onboarding",
  record_missing_metric: "/api/webmcp/weekly",
  record_weekly: "/api/webmcp/weekly",
  set_weekly: "/api/webmcp/weekly",
};
const defaultMutationRoute = "/api/webmcp/daily";
const onboardingConstraint = "Do not invent wording. Ask the owner for anything missing. This never commits.";
const blockerSchema = {
  type: "object",
  additionalProperties: false,
  properties: { text: text(8000), type: { type: "string", enum: ["internal", "external_gate", "capacity", "clarity", "dependency", "other"] } },
  oneOf: [
    { required: ["text", "type"] },
    { not: { anyOf: [{ required: ["text"] }, { required: ["type"] }] } },
  ],
} as const;
const dailyTools: WebMcpTool[] = [
  { name: "gyst.get_daily_context", description: "Read only the authenticated owner’s current daily ritual context. Use returned IDs exactly when a later tool requires one.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/daily") },
  { name: "gyst.review_daily_draft", description: "Read only the authenticated owner’s current daily draft before proposing or changing it.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/daily") },
  mutation("gyst.record_moved", "Draft-only: record what the user says moved today. Do not invent wording. This never commits or closes the record.", { text: text(12000) }, ["text"]),
  mutation("gyst.record_blocker", "Draft-only: record or clear a blocker only from the user’s stated facts. This never commits or closes the record.", {}, [], blockerSchema),
  mutation("gyst.score_previous_commitment", "Draft-only: set the prior commitment outcome the user provides. This never commits or closes the record.", { commitment_id: uuid, outcome: { type: "string", enum: ["done", "partial", "deferred", "not_done", "planned_skip"] } }, ["commitment_id", "outcome"]),
  mutation("gyst.set_next_commitment", "Draft-only: set the next commitment chosen by the user. This never commits or closes the record.", { commitment_id: uuid }, ["commitment_id"]),
  mutation("gyst.record_optional_context", "Draft-only: record optional context in the user’s own terms. This never commits or closes the record.", { buried_win: { type: "string", maxLength: 4000 }, optional_context: { type: "string", maxLength: 12000 }, is_sensitive: { type: "boolean" } }),
];
const weeklyTools: WebMcpTool[] = [
  { name: "gyst.get_weekly_context", description: "Read only the authenticated owner’s bounded current-week context. Use it before asking for facts that are already present.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/weekly") },
  { name: "gyst.review_weekly_draft", description: "Read only the authenticated owner’s current weekly draft before proposing or changing it.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/weekly") },
  mutation("gyst.record_missing_metric", "Draft-only: record missing metrics the user identifies. This never commits or closes the record.", { items: { type: "array", maxItems: 12, items: text(500) } }, ["items"]),
  mutation("gyst.record_weekly_observation", "Draft-only: record the user’s observations without inventing conclusions. This never commits or closes the record.", { items: { type: "array", maxItems: 12, items: text(2000) } }, ["items"]),
  mutation("gyst.set_weekly_decision", "Draft-only: set the decision in the user’s own wording. Ask if the decision is missing. This never commits or closes the record.", { text: text(12000) }, ["text"]),
  mutation("gyst.set_weekly_arrow", "Draft-only: set the arrow the user chooses. This never commits or closes the record.", { arrow: { type: "string", enum: ["up", "steady", "down"] } }, ["arrow"]),
  mutation("gyst.set_weekly_priority", "Draft-only: set dated priorities chosen by the user. Ask for missing dates; do not invent them. This never commits or closes the record.", { priorities: { type: "array", minItems: 1, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "due_on"], properties: { title: text(500), due_on: date } } } }, ["priorities"]),
];
// Keys are handles the agent supplies with each area and goal (any short,
// unique string); goals, key dates, and commitments reference them by
// area_key or goal_key. Each tool replaces exactly one array in the draft.
const onboardingTools: WebMcpTool[] = [
  { name: "gyst.get_onboarding_draft", description: "Read only the authenticated owner’s current onboarding draft, its version, and the field contract. Read it before proposing anything so area and goal keys are reused exactly.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => get("/api/webmcp/context/onboarding") },
  mutation("gyst.propose_areas", `Draft-only: replace the draft’s areas with the areas the owner stated. Supply a short unique key per area; goals will reference it. ${onboardingConstraint}`, { areas: entries(8, 1, { key: text(120), title: text(160), description: optionalText(4000) }, ["key", "title"]) }, ["areas"]),
  mutation("gyst.propose_goals", `Draft-only: replace the draft’s goals with the goals the owner stated, each under an existing area_key from the draft. Supply a short unique key per goal; description is the owner’s why, priority is how much it matters (1 to 5). ${onboardingConstraint}`, { goals: entries(12, 1, { key: text(120), area_key: text(120), title: text(240), description: optionalText(8000), target_date: date, priority: { type: "integer", minimum: 1, maximum: 5 } }, ["key", "area_key", "title", "priority"]) }, ["goals"]),
  mutation("gyst.propose_key_dates", `Draft-only: replace the draft’s key dates with the dated moments the owner stated, each under an existing goal_key. ${onboardingConstraint}`, { key_dates: entries(24, 0, { goal_key: text(120), title: text(240), kind: { type: "string", enum: ["deadline", "milestone", "event", "review"] }, due_on: date, notes: optionalText(8000) }, ["goal_key", "title", "kind", "due_on"]) }, ["key_dates"]),
  mutation("gyst.propose_first_commitments", `Draft-only: replace the draft’s first commitments with the concrete next actions the owner stated, each under an existing goal_key. ${onboardingConstraint}`, { commitments: entries(12, 1, { goal_key: text(120), title: text(500), details: optionalText(8000), due_on: date }, ["goal_key", "title"]) }, ["commitments"]),
];
const toolsByRitual: Record<WebMcpToolsProps["ritual"], WebMcpTool[]> = { daily: dailyTools, onboarding: onboardingTools, weekly: weeklyTools };

function mutationRoute(action: string) {
  const match = Object.entries(mutationRouteByActionPrefix).find(([prefix]) => action.startsWith(prefix));
  return match ? match[1] : defaultMutationRoute;
}
function mutation(name: string, description: string, properties: Record<string, object>, required: string[] = [], inputSchema?: object): WebMcpTool {
  const action = name.replace("gyst.", "");
  const route = mutationRoute(action);
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

function registrationErrorName(error: unknown) {
  return typeof error === "object" && error && "name" in error && typeof error.name === "string" && error.name ? error.name : "UnknownError";
}

function ritualKeyFor(props: WebMcpToolsProps) {
  return props.ritual === "onboarding" ? `onboarding:${props.draftKey}` : `${props.ritual}:${props.periodStart}`;
}

export function WebMcpTools(props: WebMcpToolsProps) {
  const router = useRouter();
  const [changes, setChanges] = useState<Array<{ fields: string[]; name: string }>>([]);
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const [registrationFailures, setRegistrationFailures] = useState<RegistrationFailure[]>([]);
  const ritualKey = ritualKeyFor(props);
  const tools = toolsByRitual[props.ritual];
  const subject = props.ritual === "onboarding" ? "this onboarding draft" : "this ritual";
  useEffect(() => { const listener = (event: Event) => { const detail = (event as CustomEvent<{ fields: string[]; name: string }>).detail; markAgentDraftFields(ritualKey, detail.fields); setChanges((current) => [detail, ...current].slice(0, 5)); router.refresh(); }; window.addEventListener("gyst:webmcp-draft-updated", listener); return () => window.removeEventListener("gyst:webmcp-draft-updated", listener); }, [ritualKey, router]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const deadline = Date.now() + modelContextWaitMs;
    let retryTimer: number | undefined;
    const register = () => {
      const context = document.modelContext;
      if (!context || typeof context.registerTool !== "function") {
        if (active && Date.now() < deadline) retryTimer = window.setTimeout(register, modelContextRetryIntervalMs);
        else if (active) setRegisteredCount(-1);
        return;
      }
      void Promise.all(tools.map(async (tool) => {
        try {
          await context.registerTool(tool, { signal: controller.signal });
          return { registered: true as const };
        } catch (error) {
          const reason = registrationErrorName(error);
          console.warn(`[WebMCP] Failed to register ${tool.name}: ${reason}`, error);
          return { registered: false as const, failure: { name: tool.name, reason } };
        }
      })).then((results) => {
        if (!active) return;
        setRegisteredCount(results.filter((result) => result.registered).length);
        setRegistrationFailures(results.flatMap((result) => result.registered ? [] : [result.failure]));
      });
    };
    register();
    return () => { active = false; if (retryTimer !== undefined) window.clearTimeout(retryTimer); controller.abort(); };
  }, [tools]);
  const failureReasons = [...new Set(registrationFailures.map(({ reason }) => reason))].join(", ");
  const capability = registeredCount === null ? "Checking whether agent assistance is available…" : registeredCount === -1 ? "Agent assistance is unavailable in this browser. Your normal draft form remains fully available." : registeredCount === tools.length ? `Agent assistance is ready: all ${tools.length} draft-only tools are available in this tab.` : `Agent assistance is partially available: ${registeredCount} of ${tools.length} draft-only tools registered. ${tools.length - registeredCount} unavailable (${failureReasons || "UnknownError"}).`;
  return <section className="mt-6 space-y-3" aria-label="Agent assistance">
    <aside aria-live="polite" className="rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm"><p className="font-semibold">WebMCP agent assistance</p><p className="mt-1 leading-6 text-muted">{capability}</p><p className="mt-2 text-muted">An agent can read {subject} and prepare its draft. Only you can commit the final ledger record.</p><details className="mt-3 text-muted"><summary className="cursor-pointer font-medium text-foreground">View {subject === "this ritual" ? "this ritual’s" : "this draft’s"} tools</summary><ul className="mt-2 list-disc pl-5">{tools.map((tool) => <li key={tool.name}>{toolLabel(tool.name)}{tool.annotations?.readOnlyHint ? " — read only" : " — draft only"}</li>)}</ul></details></aside>
    {changes.length ? <aside aria-live="polite" className="rounded-xl border border-accent bg-accent-soft p-4 text-sm"><p className="font-semibold">Recent agent draft changes</p><ul className="mt-2 list-disc pl-5">{changes.map((change, index) => <li key={`${change.name}-${index}`}>{toolLabel(change.name)} updated {change.fields.map(toolLabel).join(", ")}; it was not committed.</li>)}</ul></aside> : null}
  </section>;
}
